-- Allow SCRAP as an inventory_adjustments.adjustment_type value
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_schema = 'public'
      AND table_name = 'inventory_adjustments'
      AND constraint_name = 'inventory_adjustments_adjustment_type_check'
  ) THEN
    ALTER TABLE public.inventory_adjustments
      DROP CONSTRAINT inventory_adjustments_adjustment_type_check;
  END IF;
END $$;

ALTER TABLE public.inventory_adjustments
  ADD CONSTRAINT inventory_adjustments_adjustment_type_check
  CHECK (adjustment_type IN ('PURCHASE', 'SALE', 'STOCK_TAKE', 'SCRAP'));
