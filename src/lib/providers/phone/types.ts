export interface PhoneOutreachProvider {
  placeCall(to: string, script: string): Promise<never>;
}
