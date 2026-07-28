/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface DetectedBarcode { rawValue: string }
declare class BarcodeDetector { constructor(options?: { formats?: string[] }); detect(source: ImageBitmapSource): Promise<DetectedBarcode[]> }
interface DetectedText { rawValue: string }
declare class TextDetector { detect(source: ImageBitmapSource): Promise<DetectedText[]> }
interface Window { BarcodeDetector?: typeof BarcodeDetector; TextDetector?: typeof TextDetector }
interface ZXingResult { getText(): string }
interface ZXingReader { decodeFromVideoDevice(deviceId: string | undefined, video: HTMLVideoElement, callback: (result?: ZXingResult) => void): Promise<void>; reset(): void }
interface Window { ZXing?: { BrowserMultiFormatReader: new () => ZXingReader } }
