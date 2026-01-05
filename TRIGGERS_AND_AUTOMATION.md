# Database Triggers & Automation

This document explains all the automatic behaviors built into the database schema.

## ✨ Auto-Calculations

### **1. Invoice Totals**
When you add/update/delete invoice items, the invoice totals are **automatically recalculated**:

```sql
-- Just add items with quantity and unit_price
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, tax_rate_id)
VALUES (1, 'Service hours', 10, 75.00, 1);

-- Invoice totals update automatically! ✨
-- subtotal, tax_amount, total_amount are calculated
```

**Triggers:**
- `trigger_calc_invoice_item_totals` - Calculates item subtotal, tax, and line_total
- `trigger_recalc_invoice_on_item_change` - Updates invoice totals when items change

### **2. Due Date Calculation**
If you don't provide a `due_date`, it's **automatically calculated**:

```sql
INSERT INTO invoices (invoice_number, client_id, invoice_date, payment_terms_days)
VALUES ('INV-001', 1, '2025-12-31', 14);

-- due_date is automatically set to 2026-01-14 (14 days later) ✨
```

**Trigger:** `trigger_set_invoice_due_date`

### **3. Time Entry → Invoice Linking**
When you link a time entry to an invoice, it's **automatically marked as invoiced**:

```sql
INSERT INTO invoice_time_entries (invoice_id, time_entry_id)
VALUES (1, 5);

-- time_entries.is_invoiced becomes true automatically! ✨
-- time_entries.invoice_id is set automatically! ✨
```

**Trigger:** `trigger_mark_time_entry_invoiced`

### **4. Updated At Timestamps**
`updated_at` fields are **automatically updated** on every UPDATE:

```sql
UPDATE companies SET name = 'New Name' WHERE id = 1;

-- updated_at is automatically set to NOW() ✨
```

**Triggers:** Applied to all tables with `updated_at` column

## 🔒 Data Integrity Constraints

### **1. Invoice ↔ Project ↔ Client Consistency**
You cannot create an invoice where the project doesn't belong to the client:

```sql
-- ❌ This will FAIL if project 5 doesn't belong to client 1
INSERT INTO invoices (invoice_number, client_id, project_id, invoice_date)
VALUES ('INV-BAD', 1, 5, CURRENT_DATE);
-- ERROR: Invoice project_id 5 does not belong to client_id 1
```

**Trigger:** `trigger_check_invoice_client_project`

### **2. Incoming Invoice → Project Validation**
Incoming invoices can only link to existing projects:

```sql
-- ❌ This will FAIL if project 999 doesn't exist
UPDATE incoming_invoices SET project_id = 999 WHERE id = 1;
-- ERROR: Project 999 does not exist
```

**Trigger:** `trigger_check_incoming_invoice_project`

## 📊 Periodic Maintenance

### **Overdue Invoice Updates**
Call this function periodically (e.g., daily cron job) to mark invoices as overdue:

```sql
SELECT update_overdue_invoices();
```

This automatically changes `status` from `'sent'` to `'overdue'` for unpaid invoices past their due date.

## 🎯 Benefits

### **For Developers:**
- ✅ Less code - calculations happen in DB
- ✅ Consistent - same logic everywhere
- ✅ Reliable - cannot forget to update totals
- ✅ Fast - database-level operations

### **For Data Integrity:**
- ✅ Totals always match items
- ✅ Time entries always linked correctly
- ✅ Cannot create invalid invoice/project combinations
- ✅ Timestamps always accurate

## 🧪 Testing Triggers

```sql
-- Test invoice auto-calculation
BEGIN;

INSERT INTO invoices (invoice_number, client_id, invoice_date, status)
VALUES ('TEST-001', 1, CURRENT_DATE, 'draft')
RETURNING id;

-- Insert items (use the returned ID)
INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, tax_rate_id)
VALUES
  (1, 'Item 1', 2, 50.00, 1),  -- Should auto-calc totals
  (1, 'Item 2', 1, 75.00, 2);

-- Check totals were calculated
SELECT subtotal, tax_amount, total_amount FROM invoices WHERE id = 1;

ROLLBACK;
```

## 📝 All Triggers

| Trigger | Table | Event | Purpose |
|---------|-------|-------|---------|
| `trigger_calc_invoice_item_totals` | `invoice_items` | INSERT/UPDATE | Calculate item subtotal, tax, total |
| `trigger_recalc_invoice_on_item_change` | `invoice_items` | INSERT/UPDATE/DELETE | Recalculate invoice totals |
| `trigger_mark_time_entry_invoiced` | `invoice_time_entries` | INSERT/DELETE | Mark time entries as invoiced |
| `trigger_set_invoice_due_date` | `invoices` | INSERT/UPDATE | Auto-set due date |
| `trigger_check_invoice_client_project` | `invoices` | INSERT/UPDATE | Validate project belongs to client |
| `trigger_check_incoming_invoice_project` | `incoming_invoices` | INSERT/UPDATE | Validate project exists |
| `trigger_update_*_updated_at` | All tables | UPDATE | Auto-update timestamps |

## 🚀 Future Enhancements

Potential additional triggers:

- [ ] Auto-generate invoice numbers
- [ ] Calculate VAT summaries automatically
- [ ] Prevent deletion of invoiced time entries
- [ ] Auto-archive old projects
- [ ] Email notifications on status changes
