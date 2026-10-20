/**
 * Black bottom-centre toast from the design, with an optional Undo.
 */
export function useNotify() {
  const toast = useToast()

  function notify(title: string, undo?: () => unknown | Promise<unknown>) {
    toast.add({
      title,
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

  function fail(error: unknown, fallback?: string) {
    toast.add({ title: errorMessage(error, fallback), color: 'error', duration: 6000 })
  }

  return { notify, fail }
}
