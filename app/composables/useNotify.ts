/**
 * Black bottom-centre toast from the design, with an optional Undo.
 */
export function useNotify() {
  const toast = useToast()

  function show(title: string, opts: { icon?: string, iconClass?: string, undo?: () => unknown | Promise<unknown> } = {}) {
    const { icon, iconClass, undo } = opts
    toast.add({
      title,
      icon,
      ui: iconClass ? { icon: iconClass } : undefined,
      duration: undo ? 8000 : 5000,
      color: 'neutral',
      close: { color: 'neutral', variant: 'outline', class: 'text-white ring-[#3B3F47] hover:bg-white/10' },
      actions: undo
        ? [{
            label: 'Undo',
            color: 'neutral',
            variant: 'solid',
            class: 'bg-white text-[#0B0B0C] font-bold hover:bg-[#F2F3F5]',
            onClick: async () => {
              await undo()
            }
          }]
        : undefined
    })
  }

  function notify(title: string, undo?: () => unknown | Promise<unknown>) {
    show(title, { undo })
  }

  /** Same toast with a green check, for a scan or save that went through. */
  function success(title: string, undo?: () => unknown | Promise<unknown>) {
    show(title, { icon: 'i-lucide-circle-check', iconClass: 'text-[#3FB56B]', undo })
  }

  /** Takes a caught error (message pulled from the API body) or a ready-made sentence. */
  function fail(error: unknown, fallback?: string) {
    toast.add({
      title: typeof error === 'string' ? error : errorMessage(error, fallback),
      icon: 'i-lucide-circle-alert',
      ui: { icon: 'text-[#F04A50]' },
      color: 'error',
      duration: 6000
    })
  }

  return { notify, success, fail }
}
