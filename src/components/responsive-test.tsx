export const ResponsiveTest = () => {
  return (
    <div className="p-4 space-y-4">
      <h2 className="text-lg font-semibold">Responsive Test Component</h2>

      <div className="space-y-2">
        <div className="p-2 bg-blue-100 dark:bg-blue-900">
          <p className="text-sm">This should always be visible</p>
        </div>

        <div className="p-2 bg-green-100 dark:bg-green-900 sm:hidden">
          <p className="text-sm">
            This should only be visible on mobile (hidden on sm+)
          </p>
        </div>

        <div className="p-2 bg-red-100 dark:bg-red-900 hidden sm:block">
          <p className="text-sm">
            This should only be visible on desktop (hidden on mobile)
          </p>
        </div>

        <div className="p-2 bg-yellow-100 dark:bg-yellow-900 opacity-100 sm:opacity-0 sm:group-hover:opacity-100">
          <p className="text-sm">
            This should be visible on mobile, hidden on desktop until hover
          </p>
        </div>
      </div>

      <div className="text-sm text-muted-foreground">
        <p>
          This component tests if the responsive Tailwind classes are working
          correctly.
        </p>
        <p>On mobile: You should see blue, green, and yellow boxes.</p>
        <p>
          On desktop: You should see blue, red, and yellow boxes (yellow hidden
          until hover).
        </p>
      </div>
    </div>
  );
};
