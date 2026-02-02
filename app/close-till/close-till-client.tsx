"use client"

import * as React from "react"
import { toast } from "sonner"
import { Plus, Trash2, AlertCircle, Info } from "lucide-react"
import { PageWrapper } from "@/components/page-wrapper"
import { DatePickerYMD } from "@/components/date-picker-ymd"
import { MoneyInput } from "@/components/money-input"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { getTodayJHB } from "@/lib/date-utils"
import { formatZAR, fromCents } from "@/lib/money"
import type { CashExpense, Deposit } from "@/lib/types"

export function CloseTillClient() {
  const [date, setDate] = React.useState(getTodayJHB())
  const [loading, setLoading] = React.useState(false)
  const [submitted, setSubmitted] = React.useState(false)

  // Sales inputs
  const [cashSalesCents, setCashSalesCents] = React.useState(0)
  const [cardSalesCents, setCardSalesCents] = React.useState(0)
  const [eftSalesCents, setEftSalesCents] = React.useState(0)
  const [cashCountedCents, setCashCountedCents] = React.useState(0)

  // Expenses
  const [expenses, setExpenses] = React.useState<CashExpense[]>([
    { amountCents: 0, reason: "" },
  ])

  // Deposits
  const [deposits, setDeposits] = React.useState<Deposit[]>([
    { amountCents: 0, reference: "" },
  ])

  // Expense handlers
  const addExpense = () => {
    setExpenses([...expenses, { amountCents: 0, reason: "" }])
  }

  const removeExpense = (index: number) => {
    setExpenses(expenses.filter((_, i) => i !== index))
  }

  const updateExpense = (index: number, updates: Partial<CashExpense>) => {
    setExpenses(
      expenses.map((exp, i) => (i === index ? { ...exp, ...updates } : exp))
    )
  }

  // Deposit handlers
  const addDeposit = () => {
    setDeposits([...deposits, { amountCents: 0, reference: "" }])
  }

  const removeDeposit = (index: number) => {
    setDeposits(deposits.filter((_, i) => i !== index))
  }

  const updateDeposit = (index: number, updates: Partial<Deposit>) => {
    setDeposits(
      deposits.map((dep, i) => (i === index ? { ...dep, ...updates } : dep))
    )
  }

  // Calculate totals
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amountCents, 0)
  const totalDeposits = deposits.reduce((sum, dep) => sum + dep.amountCents, 0)
  const expectedCash = cashSalesCents - totalExpenses - totalDeposits

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    const validExpenses = expenses.filter(
      (exp) => exp.amountCents > 0 && exp.reason
    )
    const validDeposits = deposits.filter((dep) => dep.amountCents > 0)

    try {
      const res = await fetch("/api/till-closes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          cashSalesCents,
          cardSalesCents,
          eftSalesCents,
          cashCountedCents,
          cashExpenses: validExpenses.length > 0 ? validExpenses : undefined,
          deposits: validDeposits.length > 0 ? validDeposits : undefined,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({ error: "Request failed" }))
        throw new Error(error.error || "Failed to close till")
      }

      toast.success("Till closed successfully")
      setSubmitted(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to close till")
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <PageWrapper
        title="Close Till"
        description="Record daily cash and card sales"
      >
        <Card className="shadow-lg max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-center text-primary">
              Till Closed Successfully
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Cash Sales</p>
                <p className="font-medium">{formatZAR(cashSalesCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Card Sales</p>
                <p className="font-medium">{formatZAR(cardSalesCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">EFT Sales</p>
                <p className="font-medium">{formatZAR(eftSalesCents)}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Cash Counted</p>
                <p className="font-medium">{formatZAR(cashCountedCents)}</p>
              </div>
            </div>

            <Separator />

            {/* Cash Control Preview */}
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>Cash Control Preview</AlertTitle>
              <AlertDescription className="mt-2 space-y-1 text-sm">
                <p>
                  Expected Cash (before tab payments):{" "}
                  <strong>{formatZAR(expectedCash)}</strong>
                </p>
                <p>
                  Cash Counted: <strong>{formatZAR(cashCountedCents)}</strong>
                </p>
                <p>
                  Variance (before tabs):{" "}
                  <strong
                    className={
                      cashCountedCents - expectedCash < 0
                        ? "text-destructive"
                        : ""
                    }
                  >
                    {formatZAR(cashCountedCents - expectedCash)}
                  </strong>
                </p>
                <p className="text-muted-foreground mt-2 text-xs">
                  Note: Tab cash payments affect expected cash and are reflected
                  in the Dashboard daily report.
                </p>
              </AlertDescription>
            </Alert>

            <Button
              className="w-full"
              onClick={() => {
                setSubmitted(false)
                setCashSalesCents(0)
                setCardSalesCents(0)
                setEftSalesCents(0)
                setCashCountedCents(0)
                setExpenses([{ amountCents: 0, reason: "" }])
                setDeposits([{ amountCents: 0, reference: "" }])
              }}
            >
              Close Another Day
            </Button>
          </CardContent>
        </Card>
      </PageWrapper>
    )
  }

  return (
    <PageWrapper
      title="Close Till"
      description="Record daily cash and card sales"
      actions={<DatePickerYMD value={date} onChange={setDate} />}
    >
      <form onSubmit={handleSubmit} className="space-y-6 max-w-2xl mx-auto">
        {/* Sales Section */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Sales</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <MoneyInput
                label="Cash Sales"
                value={cashSalesCents}
                onChange={setCashSalesCents}
              />
              <MoneyInput
                label="Card Sales"
                value={cardSalesCents}
                onChange={setCardSalesCents}
              />
              <MoneyInput
                label="EFT Sales"
                value={eftSalesCents}
                onChange={setEftSalesCents}
              />
            </div>
          </CardContent>
        </Card>

        {/* Cash Counted */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Cash Count</CardTitle>
          </CardHeader>
          <CardContent>
            <MoneyInput
              label="Cash Counted"
              value={cashCountedCents}
              onChange={setCashCountedCents}
            />
          </CardContent>
        </Card>

        {/* Cash Expenses */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Cash Expenses</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {expenses.map((expense, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <MoneyInput
                    label={index === 0 ? "Amount" : undefined}
                    value={expense.amountCents}
                    onChange={(v) => updateExpense(index, { amountCents: v })}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  {index === 0 && <Label>Reason</Label>}
                  <Input
                    value={expense.reason}
                    onChange={(e) =>
                      updateExpense(index, { reason: e.target.value })
                    }
                    placeholder="e.g. Change float"
                  />
                </div>
                {expenses.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeExpense(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addExpense}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Expense
            </Button>
          </CardContent>
        </Card>

        {/* Deposits */}
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Deposits</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {deposits.map((deposit, index) => (
              <div key={index} className="flex gap-2 items-end">
                <div className="flex-1">
                  <MoneyInput
                    label={index === 0 ? "Amount" : undefined}
                    value={deposit.amountCents}
                    onChange={(v) => updateDeposit(index, { amountCents: v })}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  {index === 0 && <Label>Reference (optional)</Label>}
                  <Input
                    value={deposit.reference || ""}
                    onChange={(e) =>
                      updateDeposit(index, { reference: e.target.value })
                    }
                    placeholder="e.g. Slip #123"
                  />
                </div>
                {deposits.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDeposit(index)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addDeposit}
            >
              <Plus className="mr-2 h-4 w-4" />
              Add Deposit
            </Button>
          </CardContent>
        </Card>

        {/* Summary */}
        <Card className="shadow-md bg-muted/50">
          <CardContent className="pt-6">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">Total Sales:</span>
              <span className="text-right font-medium">
                {formatZAR(cashSalesCents + cardSalesCents + eftSalesCents)}
              </span>
              <span className="text-muted-foreground">Total Expenses:</span>
              <span className="text-right font-medium">
                {formatZAR(totalExpenses)}
              </span>
              <span className="text-muted-foreground">Total Deposits:</span>
              <span className="text-right font-medium">
                {formatZAR(totalDeposits)}
              </span>
              <Separator className="col-span-2 my-2" />
              <span className="font-medium">Expected Cash:</span>
              <span className="text-right font-bold">{formatZAR(expectedCash)}</span>
            </div>
          </CardContent>
        </Card>

        {/* Submit */}
        <div className="flex justify-end">
          <Button type="submit" size="lg" disabled={loading}>
            {loading ? "Closing Till..." : "Close Till"}
          </Button>
        </div>
      </form>
    </PageWrapper>
  )
}
