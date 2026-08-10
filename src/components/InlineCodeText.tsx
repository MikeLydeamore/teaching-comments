type InlineCodeTextProps = {
  children: string;
  className?: string;
};

const inlineCodePattern = /(`[^`\r\n]*`)/g;

export function InlineCodeText({ children, className = "" }: InlineCodeTextProps) {
  return (
    <>
      {children.split(inlineCodePattern).map((part, index) => {
        if (part.length >= 2 && part.startsWith("`") && part.endsWith("`")) {
          return (
            <code
              className={`rounded bg-slate-100 px-1 py-0.5 font-mono text-[0.9em] font-medium text-slate-800 ${className}`}
              key={`${part}-${index}`}
            >
              {part.slice(1, -1)}
            </code>
          );
        }

        return part;
      })}
    </>
  );
}
