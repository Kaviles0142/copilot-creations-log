import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { User, Mail, Calendar, Crown, CreditCard, Settings, Shield } from 'lucide-react';

const Account = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Mock subscription data - in production, fetch from database
  const subscription = {
    plan: 'Free',
    status: 'active',
    startDate: new Date().toLocaleDateString(),
    renewalDate: null,
    features: {
      conversationsPerDay: 5,
      figuresAccess: 10,
      documentUpload: false,
    },
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
      <div className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-purple-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent mb-2">
            Account Settings
          </h1>
          <p className="text-muted-foreground">Manage your profile and subscription</p>
        </div>

        {/* Profile Information */}
        <Card className="p-6 mb-6 border-2 shadow-lg">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <User className="h-6 w-6 text-purple-500" />
              Profile Information
            </h2>
          </div>

          <div className="space-y-4">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-full bg-gradient-to-br from-purple-500 via-purple-600 to-blue-600 flex items-center justify-center text-white font-bold text-2xl shadow-lg">
                {user?.email?.charAt(0).toUpperCase()}
              </div>
              <div>
                <h3 className="font-semibold text-lg">
                  {user?.user_metadata?.full_name || 'User'}
                </h3>
                <p className="text-sm text-muted-foreground flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  {user?.email}
                </p>
              </div>
            </div>

            {/* Account Details */}
            <div className="grid md:grid-cols-2 gap-4 pt-4 border-t">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Calendar className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Member Since</p>
                  <p className="font-medium">
                    {user?.created_at
                      ? new Date(user.created_at).toLocaleDateString()
                      : 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Shield className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">Account Status</p>
                  <p className="font-medium text-green-600">Active</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Subscription Information */}
        <Card className="p-6 mb-6 border-2 shadow-lg bg-gradient-to-br from-purple-50/50 to-blue-50/50 dark:from-purple-950/20 dark:to-blue-950/20">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-semibold flex items-center gap-2">
              <Crown className="h-6 w-6 text-amber-500" />
              Membership
            </h2>
            <Button
              onClick={() => navigate('/pricing')}
              className="bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 hover:from-purple-600 hover:via-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Upgrade Plan
            </Button>
          </div>

          <div className="space-y-4">
            {/* Current Plan */}
            <div className="flex items-center justify-between p-4 bg-white dark:bg-gray-900 rounded-lg border-2">
              <div>
                <p className="text-sm text-muted-foreground">Current Plan</p>
                <p className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                  {subscription.plan}
                </p>
              </div>
              <div className="px-4 py-2 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full text-sm font-semibold">
                {subscription.status}
              </div>
            </div>

            {/* Plan Features */}
            <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border-2">
              <h3 className="font-semibold mb-3">Plan Features</h3>
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>
                    {subscription.features.conversationsPerDay} conversations per day
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>
                    Access to {subscription.features.figuresAccess} historical figures
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  <span>
                    {subscription.features.documentUpload
                      ? 'Document upload enabled'
                      : 'Document upload (Upgrade to Pro)'}
                  </span>
                </li>
              </ul>
            </div>

            {/* Billing Info */}
            {subscription.plan !== 'Free' && (
              <div className="grid md:grid-cols-2 gap-4">
                <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border-2">
                  <p className="text-xs text-muted-foreground mb-1">Started On</p>
                  <p className="font-medium">{subscription.startDate}</p>
                </div>
                <div className="p-4 bg-white dark:bg-gray-900 rounded-lg border-2">
                  <p className="text-xs text-muted-foreground mb-1">Next Billing</p>
                  <p className="font-medium">
                    {subscription.renewalDate || 'No renewal'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="p-6 border-2 shadow-lg">
          <h2 className="text-2xl font-semibold flex items-center gap-2 mb-4">
            <Settings className="h-6 w-6 text-blue-500" />
            Quick Actions
          </h2>
          <div className="grid md:grid-cols-2 gap-4">
            <Button
              variant="outline"
              className="w-full justify-start border-2 hover:bg-accent hover:border-primary/50 transition-all"
              onClick={() => navigate('/pricing')}
            >
              <Crown className="h-4 w-4 mr-2" />
              View All Plans
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-2 hover:bg-accent hover:border-primary/50 transition-all"
              disabled
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Billing History
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-2 hover:bg-accent hover:border-primary/50 transition-all"
              disabled
            >
              <Settings className="h-4 w-4 mr-2" />
              Manage Subscription
            </Button>
            <Button
              variant="outline"
              className="w-full justify-start border-2 hover:bg-accent hover:border-primary/50 transition-all text-red-600 hover:text-red-700"
              disabled
            >
              Cancel Subscription
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Account;

