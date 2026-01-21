import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Smartphone, Share, PlusSquare, Bell } from 'lucide-react';

export const metadata = {
  title: 'Push Notifications Setup - iPhone',
};

export default function PushSetupPage() {
  return (
    <div className="container max-w-2xl py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Enable Push Notifications on iPhone</h1>
        <p className="text-muted-foreground">
          Follow these steps to receive push notifications on your iPhone.
        </p>
      </div>

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                1
              </div>
              Open in Safari
            </CardTitle>
            <CardDescription>
              Make sure you&apos;re viewing this app in Safari, not another browser.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4 text-muted-foreground">
            <Smartphone className="h-8 w-8 flex-shrink-0" />
            <p>
              Push notifications on iPhone only work with Safari. If you&apos;re using Chrome or another browser,
              copy the URL and open it in Safari first.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                2
              </div>
              Add to Home Screen
            </CardTitle>
            <CardDescription>
              Install the app to your home screen for full functionality.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-4 text-muted-foreground">
              <Share className="h-8 w-8 flex-shrink-0" />
              <p>
                Tap the <strong>Share</strong> button at the bottom of Safari (the square with an arrow pointing up).
              </p>
            </div>
            <div className="flex items-start gap-4 text-muted-foreground">
              <PlusSquare className="h-8 w-8 flex-shrink-0" />
              <p>
                Scroll down and tap <strong>&quot;Add to Home Screen&quot;</strong>, then tap <strong>&quot;Add&quot;</strong> in the top right corner.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                3
              </div>
              Open from Home Screen
            </CardTitle>
            <CardDescription>
              Launch the app from its new icon on your home screen.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4 text-muted-foreground">
            <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center flex-shrink-0">
              <span className="text-2xl">📝</span>
            </div>
            <p>
              Find the app icon on your home screen and tap it to open. The app will now run in standalone mode,
              which is required for push notifications.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold">
                4
              </div>
              Enable Notifications
            </CardTitle>
            <CardDescription>
              Grant permission for push notifications.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-4 text-muted-foreground">
            <Bell className="h-8 w-8 flex-shrink-0" />
            <p>
              Go to the Dashboard and tap <strong>&quot;Enable Notifications&quot;</strong>.
              When prompted, tap <strong>&quot;Allow&quot;</strong> to receive reminder notifications.
            </p>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-950">
          <CardContent className="pt-6">
            <p className="text-sm">
              <strong>Note:</strong> Push notifications on iOS require iOS 16.4 or later.
              If you don&apos;t see the &quot;Add to Home Screen&quot; option, make sure your iPhone is updated to the latest iOS version.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
