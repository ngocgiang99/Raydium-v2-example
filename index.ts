import { ApiV3PoolInfoStandardItem, AmmV4Keys, AmmRpcData, USDCMint } from '@raydium-io/raydium-sdk-v2'
import { initSdk, txVersion } from './config'
import BN from 'bn.js'
import { isValidAmm } from './utils'
import Decimal from 'decimal.js'
import { NATIVE_MINT } from '@solana/spl-token'

export const swap = async () => {
  const raydium = await initSdk()
  const amountIn = 500
  const inputMint = NATIVE_MINT.toBase58()
  const poolId = '58oQChx4yWmvKdwLLZzBi4ChoCc2fqCUWBkwMihLYQo2' // SOL-USDC pool

  let poolInfo: ApiV3PoolInfoStandardItem | undefined
  let poolKeys: AmmV4Keys | undefined
  let rpcData: AmmRpcData

  const data = await raydium.api.fetchPoolById({ ids: poolId })
  poolInfo = data[0] as ApiV3PoolInfoStandardItem
  if (!isValidAmm(poolInfo.programId)) throw new Error('target pool is not AMM pool')
  poolKeys = await raydium.liquidity.getAmmPoolKeys(poolId)
  rpcData = await raydium.liquidity.getRpcPoolInfo(poolId)
  const [baseReserve, quoteReserve, status] = [rpcData.baseReserve, rpcData.quoteReserve, rpcData.status.toNumber()]

  if (poolInfo.mintA.address !== inputMint && poolInfo.mintB.address !== inputMint)
    throw new Error('input mint does not match pool')

  const baseIn = inputMint === poolInfo.mintA.address
  const [mintIn, mintOut] = baseIn ? [poolInfo.mintA, poolInfo.mintB] : [poolInfo.mintB, poolInfo.mintA]

  const out = raydium.liquidity.computeAmountOut({
    poolInfo: {
      ...poolInfo,
      baseReserve,
      quoteReserve,
      status,
      version: 4,
    },
    amountIn: new BN(amountIn),
    mintIn: mintIn.address,
    mintOut: mintOut.address,
    slippage: 0.01,
  })

  console.log(
    `computed swap ${new Decimal(amountIn)
      .div(10 ** mintIn.decimals)
      .toDecimalPlaces(mintIn.decimals)
      .toString()} ${mintIn.symbol || mintIn.address} to ${new Decimal(out.amountOut.toString())
      .div(10 ** mintOut.decimals)
      .toDecimalPlaces(mintOut.decimals)
      .toString()} ${mintOut.symbol || mintOut.address}, minimum amount out ${new Decimal(out.minAmountOut.toString())
      .div(10 ** mintOut.decimals)
      .toDecimalPlaces(mintOut.decimals)} ${mintOut.symbol || mintOut.address}`
  )

  const { execute } = await raydium.liquidity.swap({
    poolInfo,
    poolKeys,
    amountIn: new BN(amountIn),
    amountOut: out.minAmountOut,
    fixedSide: 'in',
    inputMint: mintIn.address,
    txVersion,
  })

  const { txId } = await execute({ sendAndConfirm: true })
  console.log(`swap successfully in amm pool:`, { txId })
}

/** uncomment code below to execute */
swap()