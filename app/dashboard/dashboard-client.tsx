"use client"

import * as React from "react"
import useSWR from "swr"
import { toast } from "sonner"
import { AlertCircle } from "lucide-react"
import { PageWrapper } from "@/components/page-wrapper"
import { DatePickerYMD } from "@/components/date-picker-ymd"
import { LoadingCards, LoadingTable } from "@/components/loading-state"
import { EmptyState } from "@/components/empty-state"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { getTodayJHB } from "@/lib/date-utils"
import { formatZAR } from "@/lib/money"
import { cn } from "@/lib/utils"
import type { DailyReport } from "@/lib/types"

const fetcher = async (url: string) => {
  const res = await fetch(url)
  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }))
    throw new Error(error.error || "Failed to fetch data")
  }
  return res.json()
}

export function DashboardClient() {
  const [date, setDate] = React.useState(getTodayJHB())

  const { data: report, error, isLoading } = useSWR<DailyReport>(
    `/api/reports/daily?date=${date}`,
    fetcher,
    {
      onError: (err) => {
        toast.error(err.message)
      },
    }
  )

  return (
    <PageWrapper
      title="Dashboard"
      description="Daily report and stock overview"
      actions={
        <DatePickerYMD value={date} onChange={setDate} />
      }
    >
      {isLoading ? (
        <>
          <LoadingCards className="mb-6" />
          <LoadingTable />
        </>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      ) : !report || !report.byProduct?.length ? (
        <EmptyState
          title="No data for this date"
          description="There is no close stock count recorded for this date yet. Complete a stock count to see the daily report."
        />
      ) : (
        <>
          {/* Warning Callout */}
          {report.warnings && report.warnings.length > 0 && (
            <Alert variant="destructive" className="mb-6">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Warnings</AlertTitle>
              <AlertDescription>
                <ul className="list-disc list-inside mt-1">
                  {report.warnings.map((warning, i) => (
                    <li key={i}>{warning}</li>
                  ))}
                </ul>
              </AlertDescription>
            </Alert>
          )}

          {/* Summary Cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-6">
            <SummaryCard
              title="Expected Revenue"
              value={report.expectedRevenueCents}
            />
            <SummaryCard
              title="Collected Sales"
              value={report.collectedSalesCents}
            />
            <SummaryCard
              title="Tab Charges"
              value={report.tabChargesCents}
            />
            <SummaryCard
              title="Accounted Sales"
              value={report.accountedSalesCents}
            />
            <SummaryCard
              title="Revenue Variance"
              value={report.revenueVarianceCents}
              variant={report.revenueVarianceCents < 0 ? "negative" : "default"}
            />
            <SummaryCard
              title="Cash Expected"
              value={report.cashExpectedCents}
            />
            <SummaryCard
              title="Cash Counted"
              value={report.cashCountedCents}
            />
            <SummaryCard
              title="Cash Variance"
              value={report.cashVarianceCents}
              variant={report.cashVarianceCents < 0 ? "negative" : "default"}
            />
          </div>

          {/* By Product Table */}
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle>By Product</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">Units Sold</TableHead>
                    <TableHead className="text-right">Unit Price</TableHead>
                    <TableHead className="text-right">Expected Revenue</TableHead>
                    <TableHead className="text-right">Opening</TableHead>
                    <TableHead className="text-right">Purchased</TableHead>
                    <TableHead className="text-right">Adjustments</TableHead>
                    <TableHead className="text-right">Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {report.byProduct.map((item) => (
                    <TableRow key={item.productId}>
                      <TableCell className="font-medium">{item.productName}</TableCell>
                      <TableCell className="text-right">{item.unitsSold}</TableCell>
                      <TableCell className="text-right">{formatZAR(item.unitPriceCents)}</TableCell>
                      <TableCell className="text-right">{formatZAR(item.expectedRevenueCents)}</TableCell>
                      <TableCell className="text-right">{item.openingUnits}</TableCell>
                      <TableCell className="text-right">{item.purchasedUnits}</TableCell>
                      <TableCell className={cn(
                        "text-right",
                        item.adjustments < 0 && "text-destructive"
                      )}>
                        {item.adjustments > 0 ? `+${item.adjustments}` : item.adjustments}
                      </TableCell>
                      <TableCell className="text-right">{item.closingUnits}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </PageWrapper>
  )
}

interface SummaryCardProps {
  title: string
  value: number
  variant?: "default" | "negative"
}

function SummaryCard({ title, value, variant = "default" }: SummaryCardProps) {
  return (
    <Card className="shadow-md">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p
          className={cn(
            "text-2xl font-bold",
            variant === "negative" && "text-destructive"
          )}
        >
          {formatZAR(value)}
        </p>
      </CardContent>
    </Card>
  )
}
