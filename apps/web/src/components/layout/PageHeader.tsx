import { cn } from "@/lib/utils";

export function PageHeader(props: {
  title: string;
  description?: string;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between", props.className)}>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
        {props.description ? (
          <p className="text-sm text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
      {props.right ? <div className="pt-2 sm:pt-0">{props.right}</div> : null}
    </div>
  );
}
