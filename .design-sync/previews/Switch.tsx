import { Switch } from "web";

export const Off = () => (
  <label className="flex items-center gap-3 text-sm">
    <Switch />
    <span>Nhắc học mỗi ngày</span>
  </label>
);

export const On = () => (
  <label className="flex items-center gap-3 text-sm">
    <Switch defaultChecked />
    <span>Hiện phiên âm IPA</span>
  </label>
);

export const Disabled = () => (
  <div className="flex flex-col gap-3 text-sm">
    <label className="flex items-center gap-3 opacity-60">
      <Switch disabled />
      <span>Đồng bộ đám mây (cần đăng nhập)</span>
    </label>
    <label className="flex items-center gap-3 opacity-60">
      <Switch disabled defaultChecked />
      <span>Chế độ thi thử (đang khoá)</span>
    </label>
  </div>
);
