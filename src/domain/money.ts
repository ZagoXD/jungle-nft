import Decimal from 'decimal.js'
import type { Eth } from './contracts'

Decimal.set({ precision: 48, rounding: Decimal.ROUND_HALF_UP })
export const eth = (value: Decimal.Value): Eth => new Decimal(value).toFixed(18)
export const sumEth = (values: Eth[]): Eth =>
  eth(values.reduce((sum, value) => sum.plus(value), new Decimal(0)))
export const multiplyEth = (value: Eth, quantity: number): Eth =>
  eth(new Decimal(value).times(quantity))
export const discountEth = (value: Eth, percent: string): Eth =>
  eth(new Decimal(value).times(percent))
export const subtractEth = (a: Eth, b: Eth): Eth => eth(new Decimal(a).minus(b))
export const formatEth = (value: Eth): string => new Decimal(value).toFixed()
