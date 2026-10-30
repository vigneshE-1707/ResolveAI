import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster(props: ToasterProps) {
  return (
    <Sonner
      theme="light"
      position="top-right"
      richColors
      closeButton
      toastOptions={{
        classNames: {
          toast: "!rounded-xl !border-border !shadow-raised !font-sans",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
