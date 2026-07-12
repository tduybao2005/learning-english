import { LogoutButton } from "web";

export const Default = () => <LogoutButton onLogout={() => {}} />;

export const Ghost = () => <LogoutButton variant="ghost" onLogout={() => {}} />;

export const Pending = () => <LogoutButton onLogout={() => {}} pending />;
