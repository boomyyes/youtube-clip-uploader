"use client";
import { useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

// A form's submit button that shows a spinner and locks while its server action runs.
// Inside the form, React's useFormStatus tracks it. A button outside its form (form="id") can't be
// tracked that way, so it shows pending from the click on; those forms remove their own card when done.
export default function SubmitButton({ children, form, onClick, disabled, ...props }: React.ComponentProps<typeof Button>) {
  const { pending } = useFormStatus();
  const [clicked, setClicked] = useState(false);
  const busy = pending || (!!form && clicked);
  return (
    <Button
      {...props}
      type="submit"
      form={form}
      aria-busy={busy}
      disabled={busy || disabled}
      onClick={(e) => {
        onClick?.(e);
        const target = form ? (document.getElementById(form) as HTMLFormElement | null) : null;
        if (target?.checkValidity()) setClicked(true);
      }}
    >
      {busy && <Spinner aria-hidden="true" role={undefined} aria-label={undefined} />}
      {children}
    </Button>
  );
}
