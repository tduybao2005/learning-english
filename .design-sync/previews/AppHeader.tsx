import { AppHeader, Button } from "web";

// `linkComponent="a"` is the design-time link: same markup the app renders, only
// without Next's client-side navigation. `logoutSlot` gets a plain Button here —
// the real LogoutButton talks to next-auth and stays in the app.
export const Default = () => (
  <div className="w-full">
    <AppHeader
      linkComponent="a"
      logoutSlot={
        <Button variant="ghost" size="sm">
          Đăng xuất
        </Button>
      }
    />
  </div>
);
