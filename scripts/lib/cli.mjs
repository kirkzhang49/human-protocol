export function readArg(name, args = process.argv.slice(2)) {
  const index = args.indexOf(name);
  if (index >= 0 && args[index + 1] && !args[index + 1].startsWith("--")) return args[index + 1];
  const prefix = `${name}=`;
  const value = args.find((arg) => arg.startsWith(prefix));
  return value ? value.slice(prefix.length) : null;
}

export function hasArg(name, args = process.argv.slice(2)) {
  return args.includes(name);
}

export function readCsvArg(name, args = process.argv.slice(2)) {
  const value = readArg(name, args);
  if (!value) return null;
  return value
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}
