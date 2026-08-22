alter table lead_activities drop constraint lead_activities_type_check;
alter table lead_activities add constraint lead_activities_type_check
  check (type in ('call', 'email', 'visit', 'note', 'meeting'));
