-- ============================================
-- MIGRATION: Add Triggers and Auto-Calculations
-- Adds constraints, triggers, and automatic linking
-- ============================================

BEGIN;

-- ============================================
-- PART 1: ADDITIONAL CONSTRAINTS
-- ============================================

-- Ensure invoices.client_id matches invoices.project_id.client_id
CREATE OR REPLACE FUNCTION check_invoice_client_matches_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NOT NULL THEN
    -- Verify the project belongs to the client
    IF NOT EXISTS (
      SELECT 1 FROM projects WHERE id = NEW.project_id AND client_id = NEW.client_id
    ) THEN
      RAISE EXCEPTION 'Invoice project_id % does not belong to client_id %', NEW.project_id, NEW.client_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_invoice_client_project
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION check_invoice_client_matches_project();

-- ============================================
-- PART 2: AUTO-CALCULATE INVOICE TOTALS
-- ============================================

-- Function to recalculate invoice totals when items change
CREATE OR REPLACE FUNCTION recalculate_invoice_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_invoice_id INTEGER;
  v_new_subtotal DECIMAL(10,2);
  v_new_tax_amount DECIMAL(10,2);
  v_new_total DECIMAL(10,2);
BEGIN
  -- Determine which invoice to update
  IF TG_OP = 'DELETE' THEN
    v_invoice_id := OLD.invoice_id;
  ELSE
    v_invoice_id := NEW.invoice_id;
  END IF;

  -- Calculate totals from invoice_items
  SELECT
    COALESCE(SUM(subtotal), 0),
    COALESCE(SUM(tax_amount), 0),
    COALESCE(SUM(line_total), 0)
  INTO v_new_subtotal, v_new_tax_amount, v_new_total
  FROM invoice_items
  WHERE invoice_id = v_invoice_id;

  -- Update the invoice
  UPDATE invoices
  SET
    subtotal = v_new_subtotal,
    tax_amount = v_new_tax_amount,
    total_amount = v_new_total,
    updated_at = NOW()
  WHERE id = v_invoice_id;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_recalc_invoice_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION recalculate_invoice_totals();

-- ============================================
-- PART 3: AUTO-CALCULATE INVOICE ITEM TOTALS
-- ============================================

-- Function to calculate line item totals
CREATE OR REPLACE FUNCTION calculate_invoice_item_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_tax_rate DECIMAL(5,2);
BEGIN
  -- Get tax rate
  IF NEW.tax_rate_id IS NOT NULL THEN
    SELECT rate INTO v_tax_rate FROM tax_rates WHERE id = NEW.tax_rate_id;
  ELSE
    v_tax_rate := 0;
  END IF;

  -- Calculate totals
  NEW.subtotal := NEW.quantity * NEW.unit_price;
  NEW.tax_amount := NEW.subtotal * (v_tax_rate / 100);
  NEW.line_total := NEW.subtotal + NEW.tax_amount;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calc_invoice_item_totals
  BEFORE INSERT OR UPDATE ON invoice_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_invoice_item_totals();

-- ============================================
-- PART 4: AUTO-MARK TIME ENTRIES AS INVOICED
-- ============================================

-- When time entry is added to an invoice, mark it
CREATE OR REPLACE FUNCTION mark_time_entry_invoiced()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Mark time entry as invoiced and link to invoice
    UPDATE time_entries
    SET
      is_invoiced = true,
      invoice_id = NEW.invoice_id,
      updated_at = NOW()
    WHERE id = NEW.time_entry_id;
  ELSIF TG_OP = 'DELETE' THEN
    -- Unmark time entry if removed from invoice
    UPDATE time_entries
    SET
      is_invoiced = false,
      invoice_id = NULL,
      updated_at = NOW()
    WHERE id = OLD.time_entry_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_mark_time_entry_invoiced
  AFTER INSERT OR DELETE ON invoice_time_entries
  FOR EACH ROW
  EXECUTE FUNCTION mark_time_entry_invoiced();

-- ============================================
-- PART 5: AUTO-UPDATE INVOICE STATUS TO OVERDUE
-- ============================================

-- Function to check and update overdue invoices
CREATE OR REPLACE FUNCTION update_overdue_invoices()
RETURNS void AS $$
BEGIN
  UPDATE invoices
  SET status = 'overdue', updated_at = NOW()
  WHERE status = 'sent'
    AND due_date < CURRENT_DATE
    AND paid_date IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Create a function that can be called periodically
COMMENT ON FUNCTION update_overdue_invoices() IS 'Call this function daily to mark overdue invoices';

-- ============================================
-- PART 6: AUTO-LINK INCOMING INVOICES TO PROJECTS
-- ============================================

-- When incoming invoice gets a project, verify it belongs to the supplier
CREATE OR REPLACE FUNCTION check_incoming_invoice_project()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND NEW.supplier_id IS NOT NULL THEN
    -- Verify the supplier is linked to this project somehow
    -- (This is flexible - you might expense things to any project)
    -- Just verify the project exists
    IF NOT EXISTS (SELECT 1 FROM projects WHERE id = NEW.project_id) THEN
      RAISE EXCEPTION 'Project % does not exist', NEW.project_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_check_incoming_invoice_project
  BEFORE INSERT OR UPDATE ON incoming_invoices
  FOR EACH ROW
  EXECUTE FUNCTION check_incoming_invoice_project();

-- ============================================
-- PART 7: AUTO-SET INVOICE DUE DATE
-- ============================================

-- Auto-calculate due date from invoice date + payment terms
CREATE OR REPLACE FUNCTION set_invoice_due_date()
RETURNS TRIGGER AS $$
BEGIN
  -- Only set if not already provided
  IF NEW.due_date IS NULL AND NEW.invoice_date IS NOT NULL THEN
    NEW.due_date := NEW.invoice_date + (COALESCE(NEW.payment_terms_days, 14) || ' days')::INTERVAL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_set_invoice_due_date
  BEFORE INSERT OR UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION set_invoice_due_date();

-- ============================================
-- PART 8: UPDATE updated_at AUTOMATICALLY
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply to all tables with updated_at
CREATE TRIGGER trigger_update_companies_updated_at
  BEFORE UPDATE ON companies
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_contacts_updated_at
  BEFORE UPDATE ON contacts
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_projects_updated_at
  BEFORE UPDATE ON projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_time_entries_updated_at
  BEFORE UPDATE ON time_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_invoices_updated_at
  BEFORE UPDATE ON invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_incoming_invoices_updated_at
  BEFORE UPDATE ON incoming_invoices
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_vat_payments_updated_at
  BEFORE UPDATE ON vat_payments
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER trigger_update_business_info_updated_at
  BEFORE UPDATE ON business_info
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

COMMIT;

-- ============================================
-- VERIFICATION
-- ============================================

SELECT '✅ Triggers and constraints added!' as status;

-- Show all triggers
SELECT
  event_object_table as table_name,
  trigger_name,
  event_manipulation as event
FROM information_schema.triggers
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
