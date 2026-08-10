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
              className={`qwt-inline-code rounded px-1 py-0.5 font-mono text-[0.9em] font-medium ${className}`}
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
