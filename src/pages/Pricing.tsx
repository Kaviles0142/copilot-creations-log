import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Check, Sparkles, Zap, Crown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const Pricing = () => {
  const [loading, setLoading] = useState<string | null>(null);
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const plans = [
    {
      id: 'free',
      name: 'Free',
      price: '$0',
      period: 'forever',
      description: 'Perfect for trying out our AI experience',
      icon: Sparkles,
      iconColor: 'text-gray-500',
      bgGradient: 'from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800',
      borderColor: 'border-gray-300 dark:border-gray-700',
      features: [
        '5 conversations per day',
        'Access to 10 historical figures',
        'Basic voice responses',
        'Standard response time',
        'Community support',
      ],
      cta: 'Current Plan',
      highlighted: false,
    },
    {
      id: 'pro',
      name: 'Pro',
      price: '$9.99',
      period: 'per month',
      description: 'For enthusiasts who want more',
      icon: Zap,
      iconColor: 'text-purple-500',
      bgGradient: 'from-purple-50 to-blue-50 dark:from-purple-950/30 dark:to-blue-950/30',
      borderColor: 'border-purple-300 dark:border-purple-700',
      features: [
        'Unlimited conversations',
        'Access to 50+ historical figures',
        'Premium voice quality',
        'Fast response time',
        'Document upload (10MB)',
        'Priority support',
        'Export conversations',
      ],
      cta: 'Upgrade to Pro',
      highlighted: true,
    },
    {
      id: 'premium',
      name: 'Premium',
      price: '$19.99',
      period: 'per month',
      description: 'The ultimate AI historical experience',
      icon: Crown,
      iconColor: 'text-amber-500',
      bgGradient: 'from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30',
      borderColor: 'border-amber-300 dark:border-amber-700',
      features: [
        'Everything in Pro',
        'Access to ALL historical figures',
        'Ultra-premium voice quality',
        'Instant response time',
        'Unlimited document upload (100MB)',
        'Custom AI personalities',
        'API access',
        'White-label option',
        '24/7 Premium support',
      ],
      cta: 'Upgrade to Premium',
      highlighted: false,
    },
  ];

  const handleSubscribe = async (planId: string) => {
    if (!user) {
      navigate('/signin');
      return;
    }

    if (planId === 'free') {
      toast({
        title: 'Already on Free Plan',
        description: 'You are currently using the free plan.',
      });
      return;
    }

    setLoading(planId);

    try {
      // TODO: Integrate with Stripe or payment provider
      // This is a placeholder for actual payment integration
      
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      toast({
        title: 'Coming Soon!',
        description: `Payment integration for ${planId} plan will be available soon.`,
      });

      // In production, you would:
      // 1. Call Stripe to create a checkout session
      // 2. Redirect user to Stripe checkout
      // 3. Handle webhook for successful payment
      // 4. Update user subscription in database
      
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message || 'Failed to process subscription',
        variant: 'destructive',
      });
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 dark:from-purple-950/20 dark:via-blue-950/20 dark:to-indigo-950/20">
      <div className="container mx-auto px-4 py-12 max-w-7xl">
        {/* Header */}
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-4xl md:text-5xl font-bold bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 dark:from-purple-400 dark:via-blue-400 dark:to-indigo-400 bg-clip-text text-transparent">
            Choose Your Plan
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Unlock the full potential of AI-powered historical conversations. Choose the plan that fits your needs.
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-12">
          {plans.map((plan) => {
            const Icon = plan.icon;
            return (
              <Card
                key={plan.id}
                className={`relative p-8 space-y-6 transition-all duration-300 ${
                  plan.highlighted
                    ? 'border-4 border-purple-500 shadow-2xl scale-105 md:scale-110'
                    : `border-2 ${plan.borderColor} shadow-lg hover:shadow-xl`
                } bg-gradient-to-br ${plan.bgGradient}`}
              >
                {plan.highlighted && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2 bg-gradient-to-r from-purple-500 to-blue-600 text-white px-4 py-1 rounded-full text-sm font-semibold shadow-lg">
                    Most Popular
                  </div>
                )}

                {/* Plan Header */}
                <div className="text-center space-y-2">
                  <div className="flex justify-center mb-4">
                    <div className={`p-3 rounded-lg bg-gradient-to-br from-purple-100 to-blue-100 dark:from-purple-900/30 dark:to-blue-900/30`}>
                      <Icon className={`h-8 w-8 ${plan.iconColor}`} />
                    </div>
                  </div>
                  <h3 className="text-2xl font-bold">{plan.name}</h3>
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 dark:from-purple-400 dark:to-blue-400 bg-clip-text text-transparent">
                      {plan.price}
                    </span>
                    <span className="text-muted-foreground">/{plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{plan.description}</p>
                </div>

                {/* Features List */}
                <ul className="space-y-3">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-start gap-3">
                      <Check className="h-5 w-5 text-green-600 dark:text-green-400 flex-shrink-0 mt-0.5" />
                      <span className="text-sm">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSubscribe(plan.id)}
                  disabled={loading === plan.id || plan.id === 'free'}
                  className={`w-full h-12 font-semibold ${
                    plan.highlighted
                      ? 'bg-gradient-to-r from-purple-500 via-purple-600 to-blue-600 hover:from-purple-600 hover:via-purple-700 hover:to-blue-700 shadow-lg hover:shadow-xl'
                      : 'bg-gradient-to-r from-gray-700 to-gray-800 hover:from-gray-800 hover:to-gray-900 dark:from-gray-600 dark:to-gray-700'
                  } transition-all duration-200 hover:scale-105`}
                >
                  {loading === plan.id ? 'Processing...' : plan.cta}
                </Button>
              </Card>
            );
          })}
        </div>

        {/* FAQ Section */}
        <div className="max-w-3xl mx-auto">
          <h2 className="text-2xl font-bold text-center mb-8">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <Card className="p-6 border-2">
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-sm text-muted-foreground">
                Yes! You can cancel your subscription at any time. Your access will continue until the end of your billing period.
              </p>
            </Card>
            <Card className="p-6 border-2">
              <h3 className="font-semibold mb-2">What payment methods do you accept?</h3>
              <p className="text-sm text-muted-foreground">
                We accept all major credit cards, debit cards, and digital payment methods through Stripe.
              </p>
            </Card>
            <Card className="p-6 border-2">
              <h3 className="font-semibold mb-2">Can I upgrade or downgrade my plan?</h3>
              <p className="text-sm text-muted-foreground">
                Absolutely! You can upgrade or downgrade your plan at any time. Changes take effect immediately, and we'll prorate the difference.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Pricing;

