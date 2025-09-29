// Type definitions for Web Speech API
interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  grammars: SpeechGrammarList;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  serviceURI: string;
  start(): void;
  stop(): void;
  abort(): void;
  addEventListener(type: string, listener: (event: any) => void): void;
  removeEventListener(type: string, listener: (event: any) => void): void;
  onstart: ((event: any) => void) | null;
  onend: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onresult: ((event: any) => void) | null;
  onspeechstart: ((event: any) => void) | null;
  onspeechend: ((event: any) => void) | null;
  onsoundstart: ((event: any) => void) | null;
  onsoundend: ((event: any) => void) | null;
  onaudiostart: ((event: any) => void) | null;
  onaudioend: ((event: any) => void) | null;
  onnomatch: ((event: any) => void) | null;
}

interface SpeechGrammarList {
  readonly length: number;
  item(index: number): SpeechGrammar;
  [index: number]: SpeechGrammar;
  addFromURI(src: string, weight?: number): void;
  addFromString(string: string, weight?: number): void;
}

interface SpeechGrammar {
  src: string;
  weight: number;
}

interface Window {
  SpeechRecognition: typeof SpeechRecognition;
  webkitSpeechRecognition: typeof SpeechRecognition;
}

declare var SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

declare var webkitSpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};