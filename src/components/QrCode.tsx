import { QRCodeSVG } from "qrcode.react";

type QrCodeProps = {
  className?: string;
  value: string;
};

export function QrCode({ className = "", value }: QrCodeProps) {
  if (!value) {
    return null;
  }

  return (
    <QRCodeSVG
      aria-label="QR code"
      bgColor="#ffffff"
      className={className}
      fgColor="#000000"
      includeMargin
      level="M"
      role="img"
      size={1024}
      style={{ display: "block", height: "100%", width: "100%" }}
      value={value}
    />
  );
}
