"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { api, ApiError, type HistoryResponse } from "@/lib/api";
import { browserTimezone, lastNDaysRange } from "@/lib/dates";

type PresetKey = "7d" | "30d" | "90d" | "custom";

const ACCENT = "var(--color-accent)";
const PROTEIN = "rgb(244 114 182)"; // pink-400
const CARBS = "rgb(96 165 250)"; // blue-400
const FAT = "rgb(251 191 36)"; // amber-400
const NEGATIVE = "rgb(220 38 38)";

export default function HistoryPage() {
  const router = useRouter();
  const [preset, setPreset] = useState<PresetKey>("30d");
  const [from, setFrom] = useState<string>(() => lastNDaysRange(30).from);
  const [to, setTo] = useState<string>(() => lastNDaysRange(30).to);
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .getHistory({ from, to, timezone: browserTimezone() })
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 401) {
          router.replace("/login");
          return;
        }
        setError(err instanceof Error ? err.message : "load failed");
      })
      .finally(() => setLoading(false));
  }, [from, to, router]);

  const onPreset = (k: PresetKey) => {
    setPreset(k);
    if (k === "custom") return;
    const days = k === "7d" ? 7 : k === "30d" ? 30 : 90;
    const r = lastNDaysRange(days);
    setFrom(r.from);
    setTo(r.to);
  };

  const summary = useMemo(() => {
    if (!data) return null;
    const totals = data.days.reduce(
      (a, d) => ({
        consumed: a.consumed + d.caloriesConsumed,
        burned: a.burned + d.caloriesBurned,
        protein: a.protein + d.proteinG,
        carbs: a.carbs + d.carbsG,
        fat: a.fat + d.fatG,
      }),
      { consumed: 0, burned: 0, protein: 0, carbs: 0, fat: 0 },
    );
    const n = data.days.length;
    return {
      n,
      avgConsumed: n ? totals.consumed / n : 0,
      avgBurned: n ? totals.burned / n : 0,
      avgProtein: n ? totals.protein / n : 0,
      avgCarbs: n ? totals.carbs / n : 0,
      avgFat: n ? totals.fat / n : 0,
    };
  }, [data]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <a
          href="/"
          className="font-mono text-xs uppercase tracking-widest text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
        >
          ← macros
        </a>
        <span className="font-mono text-xs uppercase tracking-widest text-zinc-500">
          history
        </span>
        <span className="w-12" />
      </header>

      <div className="flex flex-wrap items-end gap-3">
        <div className="inline-flex rounded-md border border-zinc-300 bg-white p-0.5 dark:border-zinc-700 dark:bg-zinc-900">
          {(["7d", "30d", "90d", "custom"] as PresetKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => onPreset(k)}
              className={`rounded px-3 py-1 text-xs ${
                preset === k
                  ? "bg-[color:var(--color-accent)] font-medium text-zinc-900"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
            <span className="text-zinc-400">→</span>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="rounded-md border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            />
          </div>
        )}
        <div className="ml-auto text-xs text-zinc-500">
          {data?.timezone && <span className="font-mono">{data.timezone}</span>}
        </div>
      </div>

      {error && (
        <p className="mt-6 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      {loading && !data && (
        <p className="mt-12 text-center text-sm text-zinc-500">Loading…</p>
      )}

      {data && (
        <>
          {summary && (
            <section className="mt-6 grid grid-cols-2 gap-x-6 gap-y-2 rounded-md border border-zinc-200 bg-zinc-50 px-5 py-4 text-sm tabular-nums dark:border-zinc-800 dark:bg-zinc-900 sm:grid-cols-5">
              <Stat
                label="Days"
                value={summary.n}
              />
              <Stat
                label="Avg consumed"
                value={`${Math.round(summary.avgConsumed)}`}
                suffix="kcal"
                accent
              />
              <Stat
                label="Avg burned"
                value={`${Math.round(summary.avgBurned)}`}
                suffix="kcal"
              />
              <Stat
                label="Avg protein"
                value={`${Math.round(summary.avgProtein)}`}
                suffix="g"
              />
              <Stat
                label="Avg carbs / fat"
                value={`${Math.round(summary.avgCarbs)} / ${Math.round(summary.avgFat)}`}
                suffix="g"
              />
            </section>
          )}

          <ChartCard title="Calories consumed">
            <ResponsiveContainer width="100%" height={260}>
              <LineChart
                data={data.days}
                margin={{ top: 10, right: 16, bottom: 0, left: -10 }}
              >
                <CartesianGrid stroke="rgb(228 228 231)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fill: "rgb(113 113 122)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "rgb(113 113 122)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  formatter={(v: number) => `${Math.round(v)} kcal`}
                  labelFormatter={(d: string) => shortDate(d)}
                  contentStyle={tooltipStyle}
                />
                {data.targets?.calories != null && (
                  <ReferenceLine
                    y={data.targets.calories}
                    stroke="rgb(161 161 170)"
                    strokeDasharray="4 4"
                    label={{
                      value: `target ${data.targets.calories}`,
                      position: "right",
                      fill: "rgb(113 113 122)",
                      fontSize: 10,
                    }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="caloriesConsumed"
                  stroke={ACCENT}
                  strokeWidth={2}
                  dot={{ r: 2 }}
                  activeDot={{ r: 4 }}
                  isAnimationActive={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Macros (g)">
            <ResponsiveContainer width="100%" height={260}>
              <BarChart
                data={data.days}
                margin={{ top: 10, right: 16, bottom: 0, left: -10 }}
              >
                <CartesianGrid stroke="rgb(228 228 231)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fill: "rgb(113 113 122)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "rgb(113 113 122)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  formatter={(v: number) => `${Math.round(v)} g`}
                  labelFormatter={(d: string) => shortDate(d)}
                  contentStyle={tooltipStyle}
                />
                <Legend
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 11, color: "rgb(113 113 122)" }}
                />
                <Bar dataKey="proteinG" stackId="m" fill={PROTEIN} name="Protein" />
                <Bar dataKey="carbsG" stackId="m" fill={CARBS} name="Carbs" />
                <Bar dataKey="fatG" stackId="m" fill={FAT} name="Fat" />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Net vs target (kcal)">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={data.days.map((d) => ({
                  date: d.date,
                  net:
                    data.targets?.calories != null
                      ? Math.round(
                          d.caloriesConsumed -
                            data.targets.calories -
                            d.caloriesBurned,
                        )
                      : 0,
                }))}
                margin={{ top: 10, right: 16, bottom: 0, left: -10 }}
              >
                <CartesianGrid stroke="rgb(228 228 231)" strokeDasharray="2 4" />
                <XAxis
                  dataKey="date"
                  tickFormatter={shortDate}
                  tick={{ fill: "rgb(113 113 122)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fill: "rgb(113 113 122)", fontSize: 11 }}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <ReferenceLine y={0} stroke="rgb(161 161 170)" />
                <Tooltip
                  formatter={(v: number) =>
                    v > 0 ? `+${v} kcal (surplus)` : `${v} kcal (deficit)`
                  }
                  labelFormatter={(d: string) => shortDate(d)}
                  contentStyle={tooltipStyle}
                />
                <Bar dataKey="net">
                  {data.days.map((d) => {
                    const net =
                      data.targets?.calories != null
                        ? d.caloriesConsumed -
                          data.targets.calories -
                          d.caloriesBurned
                        : 0;
                    return (
                      <Cell
                        key={d.date}
                        fill={net > 0 ? NEGATIVE : ACCENT}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
            {data.targets?.calories == null && (
              <p className="px-4 pb-4 text-xs text-zinc-500">
                Set a calorie target in{" "}
                <a
                  href="/settings"
                  className="text-[color:var(--color-accent)] hover:underline"
                >
                  Settings
                </a>{" "}
                to see deficit / surplus.
              </p>
            )}
          </ChartCard>
        </>
      )}
    </main>
  );
}

// ---------------------------------------------------------------------------

function shortDate(s: string): string {
  // s is YYYY-MM-DD — show as "May 1"
  const [, m, d] = s.split("-");
  const month = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ][Number(m) - 1];
  return `${month} ${Number(d)}`;
}

const tooltipStyle = {
  background: "rgb(24 24 27)",
  border: "1px solid rgb(63 63 70)",
  borderRadius: 6,
  fontSize: 12,
  fontVariantNumeric: "tabular-nums" as const,
  color: "rgb(244 244 245)",
};

function ChartCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6 rounded-md border border-zinc-200 dark:border-zinc-800">
      <h3 className="border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-widest text-zinc-500 dark:border-zinc-800">
        {title}
      </h3>
      <div className="px-2 pt-3">{children}</div>
    </section>
  );
}

function Stat({
  label,
  value,
  suffix,
  accent,
}: {
  label: string;
  value: number | string;
  suffix?: string;
  accent?: boolean;
}) {
  return (
    <div>
      <div className="text-xs uppercase tracking-widest text-zinc-500">
        {label}
      </div>
      <div
        className={`mt-1 text-lg font-semibold ${
          accent ? "text-[color:var(--color-accent)]" : ""
        }`}
      >
        {value}
        {suffix && (
          <span className="ml-1 text-xs font-normal text-zinc-500">
            {suffix}
          </span>
        )}
      </div>
    </div>
  );
}
