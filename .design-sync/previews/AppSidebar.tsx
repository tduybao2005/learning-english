import { AppSidebar } from "web";

// The sidebar is `fixed inset-y-0 left-0 ... hidden lg:flex`, so it only paints
// at ≥1024px — hence the wide viewport override in config.json.
export const Dashboard = () => (
  <div className="relative h-[520px] w-full">
    <AppSidebar
      name="Nguyễn Công Duy"
      email="duy@example.com"
      band={6.5}
      pathname="/dashboard"
      linkComponent="a"
    />
  </div>
);

export const ListeningActive = () => (
  <div className="relative h-[520px] w-full">
    <AppSidebar
      name={null}
      email="learner@example.com"
      band={null}
      pathname="/listening/practice_a2_02"
      linkComponent="a"
    />
  </div>
);
