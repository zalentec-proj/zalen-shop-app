export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { SettingsShell } = await import('./SettingsShell');
  return <SettingsShell>{children}</SettingsShell>;
}
