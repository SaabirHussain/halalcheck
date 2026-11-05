export type PushMessage = {
  notificationId: string;
  deviceId: string;
  platform: "ios" | "android";
  token: string;
  title: string;
  body: string;
  data: {
    link: string;
  };
};

export interface PushProvider {
  send(message: PushMessage): Promise<void>;
}
