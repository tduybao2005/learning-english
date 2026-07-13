import { AppHeader } from "web";

// Brand only. Navigation moved to MobileTabBar (the fixed bottom tab bar), and
// sign-out lives on the settings page that both navs link to — so the header
// carries neither. `linkComponent="a"` is the design-time link: same markup the
// app renders, only without Next's client-side navigation.
export const Default = () => (
  <div className="w-full">
    <AppHeader linkComponent="a" />
  </div>
);
