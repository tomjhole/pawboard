-- Remove part_day from calculation method
alter table pricing_settings
  drop constraint if exists pricing_settings_calculation_method_check;

update pricing_settings
  set calculation_method = 'nightly'
  where calculation_method = 'part_day';

alter table pricing_settings
  add constraint pricing_settings_calculation_method_check
  check (calculation_method in ('nightly', 'daily'));

-- Add adhoc to extras frequency
alter table booking_extras_catalog
  drop constraint if exists booking_extras_catalog_charge_frequency_check;
alter table booking_extras_catalog
  add constraint booking_extras_catalog_charge_frequency_check
  check (charge_frequency in ('once', 'nightly', 'daily', 'adhoc'));
