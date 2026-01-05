# 📊 Reporting & Analytics Views

Auto-calculated reporting views for profit & loss, VAT declarations, and business insights.

## ✨ Key Features

- **✅ Automatic calculations** - No manual queries needed
- **✅ Real-time updates** - Views always show current data
- **✅ VAT ready** - Quarterly declarations ready for filing
- **✅ Multi-dimensional** - By period, client, project, category

---

## 💰 Profit & Loss

### **1. Profit & Loss Summary**
Monthly profit/loss overview:

```sql
SELECT * FROM profit_loss_summary;
```

**Example Output:**
```
 period  | income_excl_vat | expense_excl_vat | profit_excl_vat | profit_total
---------+-----------------+------------------+-----------------+--------------
 2025-12 |         2518.00 |             0.00 |         2518.00 |      2978.62
 2025-11 |            0.00 |            82.25 |          -82.25 |       -82.25
```

**Columns:**
- `period` - Month (YYYY-MM)
- `income_excl_vat` - Revenue excluding VAT
- `expense_excl_vat` - Expenses excluding VAT
- `profit_excl_vat` - Profit/loss before VAT
- `income_vat`, `expense_vat` - VAT amounts
- `profit_total` - Final profit/loss

### **2. Detailed P&L**
Breakdown by income vs expenses:

```sql
SELECT * FROM profit_loss
WHERE period >= '2025-01-01'
ORDER BY period DESC, type;
```

---

## 🧾 VAT (BTW) Declarations

### **1. VAT Declaration (Ready for Quarterly Filing)**
Everything you need for your quarterly VAT return:

```sql
SELECT * FROM vat_declaration;
```

**Example Output:**
```
 year | quarter | high_rate_vat_collected | low_rate_vat_collected | input_vat | net_vat_to_pay
------+---------+-------------------------+------------------------+-----------+----------------
 2025 |       4 |                  409.50 |                  51.12 |      0.00 |         460.62
```

**Columns:**
- `high_rate_revenue` - Revenue at 21% (box 1a)
- `high_rate_vat_collected` - VAT collected at 21% (box 1b)
- `low_rate_revenue` - Revenue at 9% (box 1c)
- `low_rate_vat_collected` - VAT collected at 9% (box 1d)
- `zero_rate_revenue` - Zero-rated revenue
- `input_vat` - VAT paid on expenses (voorbelasting)
- `net_vat_to_pay` - Total to pay/receive

**Use this for:**
- Quarterly VAT returns (aangifte omzetbelasting)
- Checking your VAT liability
- Reconciliation

### **2. VAT Summary by Quarter**
Detailed breakdown by tax rate:

```sql
SELECT * FROM vat_summary_by_quarter
WHERE year = 2025 AND quarter = 4;
```

---

## 👥 Client & Supplier Analytics

### **Income by Client**
Revenue breakdown per client:

```sql
SELECT * FROM income_by_client;
```

**Example:**
```
       client_name        | invoice_count | total_incl_vat | paid_amount | outstanding_amount
--------------------------+---------------+----------------+-------------+--------------------
 Moods AI B.V. i.o.       |             1 |        2359.50 |           0 |            2359.50
 Joosten Investments B.V. |             1 |         619.12 |      619.12 |                  0
```

**Shows:**
- Total revenue per client
- Paid vs outstanding invoices
- First and last invoice dates
- Number of invoices

### **Expenses by Supplier**
Spending breakdown per supplier:

```sql
SELECT * FROM expenses_by_supplier;
```

### **Expenses by Category**
Where your money goes:

```sql
SELECT * FROM expenses_by_category
ORDER BY total_incl_vat DESC;
```

---

## 🎯 Project Analytics

### **Project Profitability**
See which projects make money:

```sql
SELECT
  project_name,
  client_name,
  chargeable_hours,
  revenue_excl_vat,
  expense_excl_vat,
  profit_excl_vat,
  effective_hourly_rate
FROM project_profitability
WHERE revenue_excl_vat > 0
ORDER BY profit_excl_vat DESC;
```

**Shows:**
- Revenue per project
- Expenses linked to project
- Profit/loss
- **Effective hourly rate** (revenue ÷ chargeable hours)
- Time tracked vs invoiced

**Use this to:**
- Identify most profitable projects
- See if you're charging enough
- Compare effective rate vs agreed hourly rate

---

## 📅 Common Queries

### **Monthly Revenue Trend**
```sql
SELECT
  period,
  income_excl_vat,
  income_total
FROM profit_loss_summary
WHERE period_date >= DATE_TRUNC('month', CURRENT_DATE - INTERVAL '6 months')
ORDER BY period;
```

### **Quarterly VAT Summary**
```sql
SELECT
  period,
  high_rate_vat_collected,
  low_rate_vat_collected,
  input_vat,
  net_vat_to_pay
FROM vat_declaration
WHERE year = EXTRACT(YEAR FROM CURRENT_DATE)
ORDER BY quarter;
```

### **Top Clients by Revenue**
```sql
SELECT
  client_name,
  invoice_count,
  total_incl_vat,
  ROUND(total_incl_vat / invoice_count, 2) as avg_invoice_value
FROM income_by_client
ORDER BY total_incl_vat DESC
LIMIT 5;
```

### **Unpaid Invoices**
```sql
SELECT
  c.name as client_name,
  i.invoice_number,
  i.invoice_date,
  i.due_date,
  i.total_amount,
  CURRENT_DATE - i.due_date as days_overdue
FROM invoices i
JOIN companies c ON i.client_id = c.id
WHERE i.status IN ('sent', 'overdue')
  AND i.paid_date IS NULL
ORDER BY i.due_date;
```

### **Expenses Needing Review**
```sql
SELECT
  supplier_name,
  invoice_date,
  total_amount,
  category_id,
  created_at
FROM incoming_invoices
WHERE review_status = 'pending'
ORDER BY created_at DESC;
```

---

## 🔄 Data Freshness

All views show **real-time data**:
- ✅ When you add an invoice → immediately in P&L
- ✅ When you approve an expense → immediately in VAT summary
- ✅ When you mark invoice paid → outstanding amount updates

No cache, no refresh needed!

---

## 📊 Export for Accountant

### **Full Year Summary**
```sql
SELECT
  period,
  income_excl_vat,
  expense_excl_vat,
  profit_excl_vat,
  income_vat,
  expense_vat
FROM profit_loss_summary
WHERE period LIKE '2025%'
ORDER BY period;
```

Save as CSV and send to your accountant.

### **All Expenses for Tax Deduction**
```sql
SELECT
  ii.invoice_date,
  c.name as supplier,
  ec.name as category,
  ii.description,
  ii.subtotal,
  ii.tax_amount,
  ii.total_amount
FROM incoming_invoices ii
LEFT JOIN companies c ON ii.supplier_id = c.id
LEFT JOIN expense_categories ec ON ii.category_id = ec.id
WHERE review_status = 'approved'
  AND EXTRACT(YEAR FROM ii.invoice_date) = 2025
ORDER BY ii.invoice_date;
```

---

## 💡 Tips

1. **Run VAT check before filing**
   ```sql
   SELECT * FROM vat_declaration WHERE year = 2025 AND quarter = 4;
   ```

2. **Monthly review**
   ```sql
   SELECT * FROM profit_loss_summary WHERE period = TO_CHAR(CURRENT_DATE, 'YYYY-MM');
   ```

3. **Project health check**
   ```sql
   SELECT * FROM project_profitability WHERE effective_hourly_rate < 50;
   ```

4. **Client payment behavior**
   ```sql
   SELECT
     client_name,
     outstanding_amount,
     paid_amount,
     ROUND(100.0 * paid_amount / NULLIF(paid_amount + outstanding_amount, 0), 1) as payment_rate
   FROM income_by_client
   WHERE total_incl_vat > 0;
   ```

---

**Status:** ✅ All views working and tested!
