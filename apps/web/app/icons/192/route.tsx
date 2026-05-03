import { ImageResponse } from "next/og";
import { Mark } from "@/components/branding/Mark";

const SIZE = 192;

export function GET() {
  return new ImageResponse(<Mark size={SIZE} />, { width: SIZE, height: SIZE });
}
