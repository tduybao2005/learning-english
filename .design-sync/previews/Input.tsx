import { Input } from "web";

export const Default = () => (
  <div className="w-72">
    <Input placeholder="Nhập từ tiếng Anh…" />
  </div>
);

export const Filled = () => (
  <div className="w-72">
    <Input defaultValue="accomplishment" />
  </div>
);

export const Invalid = () => (
  <div className="w-72 space-y-1.5">
    <Input aria-invalid defaultValue="recieve" />
    <p className="text-sm text-destructive">Sai chính tả — đúng là “receive”.</p>
  </div>
);

export const Disabled = () => (
  <div className="w-72">
    <Input disabled placeholder="Chưa mở khoá phần này" />
  </div>
);
