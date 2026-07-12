import { SettingsNameEditor } from "web";

// The editor is styled for the settings page's primary (dark indigo) banner —
// this wrapper reproduces that surface so the white-on-primary type is legible.
const Banner = ({ children }: { children: React.ReactNode }) => (
  <div className="flex w-[28rem] items-center gap-3 rounded-xl bg-primary p-4 text-primary-foreground">
    {children}
  </div>
);

export const View = () => (
  <Banner>
    <SettingsNameEditor name="Bảo Trần" email="bao@example.com" onSave={() => {}} />
  </Banner>
);

// No display name yet: falls back to the email, with no secondary line.
export const NoName = () => (
  <Banner>
    <SettingsNameEditor name={null} email="bao@example.com" onSave={() => {}} />
  </Banner>
);

// `defaultEditing` exists precisely so the edit state can be rendered statically.
export const Editing = () => (
  <Banner>
    <SettingsNameEditor name="Bảo Trần" email="bao@example.com" onSave={() => {}} defaultEditing />
  </Banner>
);

export const EditingError = () => (
  <Banner>
    <SettingsNameEditor
      name="Bảo Trần"
      email="bao@example.com"
      onSave={() => {}}
      defaultEditing
      error
    />
  </Banner>
);
