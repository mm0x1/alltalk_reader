/**
 * Short notices for news the reader would otherwise miss, such as a chapter finishing saving
 * after Contents was closed. Shown by Toaster (in the root layout). Problems stay until they
 * are closed; everything else leaves by itself.
 */

export interface ToastAction {
	label: string;
	run: () => void;
}

export interface Toast {
	id: number;
	message: string;
	problem: boolean;
	action: ToastAction | null;
}

const SHOW_MS = 6_000;
const SHOW_WITH_ACTION_MS = 10_000;
/** More than this and the oldest goes: a stack of notices would cover the page. */
const MAX_SHOWN = 3;

class Toasts {
	items = $state<Toast[]>([]);
	#next = 1;
	#timers = new Map<number, ReturnType<typeof setTimeout>>();

	show(message: string, options: { problem?: boolean; action?: ToastAction } = {}): number {
		const toast: Toast = {
			id: this.#next++,
			message,
			problem: options.problem ?? false,
			action: options.action ?? null
		};
		this.items = [...this.items, toast].slice(-MAX_SHOWN);
		for (const id of this.#timers.keys()) {
			if (!this.items.some((item) => item.id === id)) this.#clearTimer(id);
		}
		if (!toast.problem) {
			const delay = toast.action ? SHOW_WITH_ACTION_MS : SHOW_MS;
			this.#timers.set(
				toast.id,
				setTimeout(() => this.dismiss(toast.id), delay)
			);
		}
		return toast.id;
	}

	dismiss(id: number): void {
		this.#clearTimer(id);
		this.items = this.items.filter((item) => item.id !== id);
	}

	#clearTimer(id: number): void {
		clearTimeout(this.#timers.get(id));
		this.#timers.delete(id);
	}
}

export const toasts = new Toasts();
