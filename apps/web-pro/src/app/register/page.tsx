'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/lib/stores/auth-store';
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Alert,
  AlertDescription,
  FormInput,
  FormSelect,
} from '@trades/ui/components';
import { toast } from '@trades/ui/hooks';

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  trade?: string;
  password?: string;
  confirmPassword?: string;
}

const TRADE_OPTIONS = [
  { value: 'plumber', label: 'Plumber' },
  { value: 'electrician', label: 'Electrician' },
  { value: 'hvac', label: 'HVAC Technician' },
  { value: 'appliance_repair', label: 'Appliance Repair' },
  { value: 'locksmith', label: 'Locksmith' },
  { value: 'handyman', label: 'Handyman' },
  { value: 'roofing', label: 'Roofing' },
  { value: 'pest_control', label: 'Pest Control' },
  { value: 'landscaping', label: 'Landscaping' },
  { value: 'other', label: 'Other' },
];

export default function RegisterPage() {
  const router = useRouter();
  const { register, isLoading, error, clearError } = useAuthStore();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    trade: '',
    password: '',
    confirmPassword: '',
  });
  const [errors, setErrors] = useState<FormErrors>({});

  const validateForm = (): boolean => {
    const newErrors: FormErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Full name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    if (!formData.phone.trim()) {
      newErrors.phone = 'Phone number is required';
    } else if (!/^\+?[\d\s-()]{10,}$/.test(formData.phone)) {
      newErrors.phone = 'Please enter a valid phone number';
    }

    if (!formData.trade) {
      newErrors.trade = 'Please select your trade';
    }

    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else if (formData.password.length < 8) {
      newErrors.password = 'Password must be at least 8 characters';
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      newErrors.password = 'Password must include uppercase, lowercase, and a number';
    }

    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (field: keyof typeof formData) => (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    setFormData((prev) => ({ ...prev, [field]: e.target.value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }
  };

  const handleTradeChange = (value: string) => {
    setFormData((prev) => ({ ...prev, trade: value }));
    if (errors.trade) {
      setErrors((prev) => ({ ...prev, trade: undefined }));
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();

    if (!validateForm()) {
      return;
    }

    try {
      await register({
        email: formData.email,
        password: formData.password,
        name: formData.name,
        phone: formData.phone,
        trade: formData.trade,
      });
      toast.success({
        title: 'Account created!',
        description: 'Welcome to Trades Dispatch Pro. Complete your profile to start receiving jobs.',
      });
      router.push('/dashboard');
    } catch {
      // Error is handled by the store
    }
  };

  const isFormValid =
    formData.name.length > 0 &&
    formData.email.length > 0 &&
    formData.phone.length > 0 &&
    formData.trade.length > 0 &&
    formData.password.length > 0 &&
    formData.confirmPassword.length > 0;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 bg-muted/30">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold">Pro Portal</h1>
          <p className="text-muted-foreground mt-2">
            Join our network of trade professionals
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Register as Pro</CardTitle>
            <CardDescription>
              Create your account to start accepting jobs
            </CardDescription>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <FormInput
                label="Full Name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleChange('name')}
                placeholder="John Doe"
                error={errors.name}
                required
                autoComplete="name"
                disabled={isLoading}
              />

              <FormInput
                label="Email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange('email')}
                placeholder="you@example.com"
                error={errors.email}
                required
                autoComplete="email"
                disabled={isLoading}
              />

              <FormInput
                label="Phone Number"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange('phone')}
                placeholder="+1 (555) 000-0000"
                error={errors.phone}
                description="We'll use this to contact you about jobs"
                required
                autoComplete="tel"
                disabled={isLoading}
              />

              <FormSelect
                label="Trade/Specialty"
                name="trade"
                options={TRADE_OPTIONS}
                value={formData.trade}
                onValueChange={handleTradeChange}
                placeholder="Select your trade"
                error={errors.trade}
                required
                disabled={isLoading}
              />

              <FormInput
                label="Password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleChange('password')}
                placeholder="Create a strong password"
                error={errors.password}
                description="At least 8 characters with uppercase, lowercase, and a number"
                required
                autoComplete="new-password"
                disabled={isLoading}
              />

              <FormInput
                label="Confirm Password"
                name="confirmPassword"
                type="password"
                value={formData.confirmPassword}
                onChange={handleChange('confirmPassword')}
                placeholder="Confirm your password"
                error={errors.confirmPassword}
                required
                autoComplete="new-password"
                disabled={isLoading}
              />
            </CardContent>

            <CardFooter className="flex flex-col gap-4">
              <Button
                type="submit"
                className="w-full"
                disabled={isLoading || !isFormValid}
              >
                {isLoading ? 'Creating account...' : 'Create Pro Account'}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                Already have an account?{' '}
                <Link href="/login" className="text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </CardFooter>
          </form>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-6">
          By creating an account, you agree to our{' '}
          <Link href="/terms" className="text-primary hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="/privacy" className="text-primary hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
}
