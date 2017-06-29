import * as util from 'util';

interface NodeCallback<T> {
  (err: any, result?: T): void;
}
interface NodeCallback2<T> {
  (result: T): void;
}

declare module "util" {
  export function promisify<T>(f: (callback?: NodeCallback<undefined>) => void): () => Promise<T>;
  export function promisify<T, S>(f: (arg1: S, callback: NodeCallback<T>) => void): (arg1: S) => Promise<T>;
  export function promisify<T, S, U>(f: (arg1: S, arg2: U, callback: NodeCallback<T>) => void): (arg1: S, arg2: U) => Promise<T>;
  export function promisify<T, S, U, W>(f: (arg1: S, arg2: U, arg3: W, callback: NodeCallback<T>) => void): (arg1: S, arg2: U, arg3: W) => Promise<T>;
  export function promisify<T>(f: (callback: NodeCallback2<undefined>) => void): () => Promise<T>;
  export function promisify<T, S>(f: (arg1: S, callback: NodeCallback2<T>) => void): (arg1: S) => Promise<T>;
  export function promisify<T, S, U>(f: (arg1: S, arg2: U, callback: NodeCallback2<T>) => void): (arg1: S, arg2: U) => Promise<T>;
  export function promisify<T, S, U, W>(f: (arg1: S, arg2: U, arg3: W, callback: NodeCallback2<T>) => void): (arg1: S, arg2: U, arg3: W) => Promise<T>;
}
