# 📦 Frontend Type Schemas

**For UI Developer Reference**

These are the TypeScript types/schemas your frontend will use. They're automatically shared via tRPC!

---

## 🏢 Company Schema

```typescript
// From: backoffice/models/schemas/Company.ts
export interface Company {
  id: number;
  type: 'client' | 'supplier' | 'both';
  name: string;
  main_contact_person?: string;
  email?: string;
  phone?: string;
  street_address?: string;
  postal_code?: string;
  city?: string;
  country?: string;
  btw_number?: string;  // VAT number
  kvk_number?: string;  // Chamber of Commerce number
  iban?: string;
  notes?: string;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}
```

**Frontend Usage:**
```typescript
// Get all companies
const { data: companies } = trpc.company.getAll.useQuery();

// Get clients only
const { data: clients } = trpc.company.getAll.useQuery({
  type: 'client'
});

// Create new company
const createCompany = trpc.company.create.useMutation();
createCompany.mutate({
  type: 'client',
  name: 'Acme Corp',
  email: 'contact@acme.com',
  is_active: true,
});
```

---

## 📁 Project Schema

```typescript
// From: backoffice/models/schemas/Project.ts
export interface Project {
  id: number;
  name: string;
  client_id: number;
  description?: string;
  hourly_rate: number;
  tax_rate_id: number;
  status: 'active' | 'completed' | 'on_hold' | 'cancelled';
  start_date?: string;  // ISO date string
  end_date?: string;
  currency: string;  // Default: 'EUR'
  created_at: Date;
  updated_at: Date;
}
```

**Frontend Usage:**
```typescript
// Get all projects
const { data: projects } = trpc.project.getAll.useQuery();

// Get active projects only
const { data: activeProjects } = trpc.project.getAll.useQuery({
  status: 'active'
});

// Create new project
const createProject = trpc.project.create.useMutation();
createProject.mutate({
  name: 'Website Redesign',
  client_id: 1,
  hourly_rate: 75,
  tax_rate_id: 1,  // 21% VAT
  status: 'active',
  currency: 'EUR',
});
```

---

## 📊 Dashboard Stats

```typescript
export interface DashboardStats {
  income_this_month: number;
  expenses_this_month: number;
  active_projects: number;
  pending_reviews: number;
}
```

**Frontend Usage:**
```typescript
const { data: stats } = trpc.reporting.getDashboardStats.useQuery();

// Display in cards
<Card>
  <CardTitle>Income This Month</CardTitle>
  <CardContent>€{stats?.income_this_month.toFixed(2)}</CardContent>
</Card>
```

---

## 💰 Profit & Loss

```typescript
export interface ProfitLossSummary {
  period: Date;               // First day of month
  period_date: Date;
  income_excl_vat: number;
  expense_excl_vat: number;
  profit_excl_vat: number;
  income_vat: number;
  expense_vat: number;
  income_total: number;
  expense_total: number;
  profit_total: number;
}
```

**Frontend Usage:**
```typescript
// Get last 12 months
const { data: profitLoss } = trpc.reporting.getProfitLossSummary.useQuery({
  limit: 12
});

// Use with Recharts
const chartData = profitLoss?.map(row => ({
  month: format(row.period, 'MMM yyyy'),
  income: row.income_excl_vat,
  expenses: row.expense_excl_vat,
  profit: row.profit_excl_vat,
}));

<BarChart data={chartData}>
  <Bar dataKey="income" fill="#22c55e" />
  <Bar dataKey="expenses" fill="#ef4444" />
</BarChart>
```

---

## 🧾 VAT Declaration

```typescript
export interface VATDeclaration {
  year: number;
  quarter: number;
  period: string;  // e.g., "2025-Q4"
  high_rate_revenue: number;          // Revenue at 21%
  high_rate_vat_collected: number;    // VAT collected at 21%
  low_rate_revenue: number;           // Revenue at 9%
  low_rate_vat_collected: number;     // VAT collected at 9%
  zero_rate_revenue: number;          // Revenue at 0%
  input_vat: number;                  // VAT paid on expenses (voorbelasting)
  net_vat_to_pay: number;             // Total VAT to pay to tax office
}
```

**Frontend Usage:**
```typescript
// Get current quarter
const { data: vatDeclaration } = trpc.reporting.getVATDeclaration.useQuery();

// Get specific quarter
const { data: q4_2025 } = trpc.reporting.getVATDeclaration.useQuery({
  year: 2025,
  quarter: 4,
});

// Display
<div>
  <p>VAT Collected: €{vatDeclaration[0]?.high_rate_vat_collected}</p>
  <p>Input VAT: €{vatDeclaration[0]?.input_vat}</p>
  <p>Net to Pay: €{vatDeclaration[0]?.net_vat_to_pay}</p>
</div>
```

---

## 💸 Income by Client

```typescript
export interface IncomeByClient {
  client_id: number;
  client_name: string;
  invoice_count: number;
  revenue_excl_vat: number;
  revenue_vat: number;
  revenue_incl_vat: number;
  paid_amount: number;
  unpaid_amount: number;
  first_invoice_date: string;
  last_invoice_date: string;
}
```

**Frontend Usage:**
```typescript
const { data: incomeByClient } = trpc.reporting.getIncomeByClient.useQuery();

// Top clients table
<Table>
  {incomeByClient?.map(client => (
    <TableRow key={client.client_id}>
      <TableCell>{client.client_name}</TableCell>
      <TableCell>€{client.revenue_incl_vat.toFixed(2)}</TableCell>
      <TableCell>{client.invoice_count} invoices</TableCell>
    </TableRow>
  ))}
</Table>
```

---

## 💳 Expenses by Supplier

```typescript
export interface ExpensesBySupplier {
  supplier_id: number;
  supplier_name: string;
  supplier_type: string;
  invoice_count: number;
  total_excl_vat: number;
  total_vat: number;
  total_incl_vat: number;
  paid_amount: number;
  unpaid_amount: number;
  first_expense_date: string;
  last_expense_date: string;
}
```

**Frontend Usage:**
```typescript
const { data: expensesBySupplier } = trpc.reporting.getExpensesBySupplier.useQuery();
```

---

## 📈 Project Profitability

```typescript
export interface ProjectProfitability {
  project_id: number;
  project_name: string;
  client_id: number;
  client_name: string;
  revenue_excl_vat: number;
  expense_excl_vat: number;
  profit_excl_vat: number;
  revenue_incl_vat: number;
  profit_incl_vat: number;
  effective_hourly_rate: number;  // Actual earned per hour
}
```

**Frontend Usage:**
```typescript
const { data: profitability } = trpc.reporting.getProjectProfitability.useQuery();

// Sort by profit
const topProjects = profitability?.sort((a, b) =>
  b.profit_excl_vat - a.profit_excl_vat
);
```

---

## 🔄 Common Patterns

### Loading States
```typescript
const { data, isLoading, error } = trpc.company.getAll.useQuery();

if (isLoading) return <Spinner />;
if (error) return <Alert>Error: {error.message}</Alert>;
return <CompanyList companies={data} />;
```

### Mutations with Optimistic Updates
```typescript
const utils = trpc.useUtils();

const createCompany = trpc.company.create.useMutation({
  onSuccess: () => {
    // Refresh company list
    utils.company.getAll.invalidate();
    toast({ title: 'Company created!' });
  },
  onError: (error) => {
    toast({ title: 'Error', description: error.message });
  },
});
```

### Form Validation with Zod
```typescript
import { CompanySchema } from '@/../../backoffice/models/schemas/Company';

const form = useForm({
  resolver: zodResolver(CompanySchema.omit({
    id: true,
    created_at: true,
    updated_at: true
  })),
});

// TypeScript automatically knows all fields!
```

---

## 📡 Available tRPC Endpoints

### Companies
- `trpc.company.getAll.useQuery({ type?, isActive? })`
- `trpc.company.getById.useQuery({ id })`
- `trpc.company.create.useMutation()`
- `trpc.company.update.useMutation({ id, data })`
- `trpc.company.delete.useMutation({ id })`

### Projects
- `trpc.project.getAll.useQuery({ status?, clientId? })`
- `trpc.project.getById.useQuery({ id })`
- `trpc.project.create.useMutation()`
- `trpc.project.update.useMutation({ id, data })`
- `trpc.project.delete.useMutation({ id })`

### Reporting
- `trpc.reporting.getDashboardStats.useQuery()`
- `trpc.reporting.getProfitLossSummary.useQuery({ limit? })`
- `trpc.reporting.getVATSummary.useQuery()`
- `trpc.reporting.getVATDeclaration.useQuery({ year?, quarter? })`
- `trpc.reporting.getIncomeByClient.useQuery()`
- `trpc.reporting.getExpensesBySupplier.useQuery()`
- `trpc.reporting.getProjectProfitability.useQuery()`

---

## ✅ Type Safety Benefits

**The magic:** All these types are automatically shared between backend and frontend via tRPC!

1. **Autocomplete**: Your IDE suggests exact fields
2. **Validation**: TypeScript catches typos at compile-time
3. **Refactoring**: Change schema → frontend updates automatically
4. **Documentation**: Types serve as living documentation

**Example:**
```typescript
const company = trpc.company.getById.useQuery({ id: 1 });

// ✅ TypeScript knows these exist:
company.data?.name
company.data?.email
company.data?.is_active

// ❌ TypeScript errors:
company.data?.nonexistent  // Property 'nonexistent' does not exist
```

---

## 🚀 Getting Started

1. **Install tRPC client** (in frontend-next):
   ```bash
   npm install @trpc/client @trpc/react-query @tanstack/react-query
   ```

2. **Set up tRPC client** (see FRONTEND_MIGRATION_PLAN.md)

3. **Start coding!** Types are already available through tRPC

---

**Backend is running on:** http://localhost:7000
**Health check:** http://localhost:7000/health
**tRPC endpoint:** http://localhost:7000/trpc

For full implementation details, see [FRONTEND_MIGRATION_PLAN.md](FRONTEND_MIGRATION_PLAN.md).
