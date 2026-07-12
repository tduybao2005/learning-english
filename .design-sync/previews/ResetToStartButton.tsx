import { ResetToStartButton } from "web";

export const Default = () => <ResetToStartButton onReset={() => {}} />;

export const Pending = () => <ResetToStartButton onReset={() => {}} pending />;

export const WithError = () => (
  <ResetToStartButton onReset={() => {}} error="Không thể đặt lại lộ trình. Vui lòng thử lại." />
);
