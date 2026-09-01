import { FormEvent, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { CheckCircle2, GraduationCap } from 'lucide-react';
import { api, ApiError } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

// Public, unauthenticated "Online Admission Enquiry" form - shareable as a
// direct link (e.g. app.nexoradsa.org/apply?school=DAS-JND-01) or embeddable
// on the school's own website, so families can submit interest without
// anyone at the school needing to be online to take the call. Lands in the
// Admissions CRM (AdmissionsPage) as a new NEW-status lead.
export default function PublicEnquiryPage() {
  const [params] = useSearchParams();
  const schoolCode = params.get('school') ?? '';

  const [childName, setChildName] = useState('');
  const [desiredClassName, setDesiredClassName] = useState('');
  const [parentName, setParentName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submitMutation = useMutation({
    mutationFn: () =>
      api.post(`/admissions/public/${encodeURIComponent(schoolCode)}/enquiries`, {
        childName,
        desiredClassName: desiredClassName || undefined,
        parentName,
        phone,
        email: email || undefined,
        address: address || undefined,
        source: 'WEBSITE',
      }),
    onError: (err: unknown) => {
      setError(err instanceof ApiError ? err.body?.message ?? err.message : 'Something went wrong. Please try again.');
    },
  });

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!childName.trim() || !parentName.trim() || !phone.trim()) {
      return setError('Please fill in the child name, parent name, and phone number.');
    }
    submitMutation.mutate();
  }

  if (!schoolCode) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
        <Card className="max-w-md">
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            This admission enquiry link is missing a school code. Please use the link provided by your school
            (it should look like <code>?school=YOUR-SCHOOL-CODE</code>).
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-6">
      <Card className="w-full max-w-lg">
        <CardContent className="p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Admission Enquiry</h1>
              <p className="text-sm text-muted-foreground">Tell us about your child and we'll get in touch.</p>
            </div>
          </div>

          {submitMutation.isSuccess ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <CheckCircle2 className="h-10 w-10 text-success" />
              <p className="font-medium text-foreground">Thank you! Your enquiry has been received.</p>
              <p className="text-sm text-muted-foreground">Our admissions team will contact you soon.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label className="mb-1.5 inline-block">
                  Child's name <span className="text-destructive">*</span>
                </Label>
                <Input value={childName} onChange={(e) => setChildName(e.target.value)} required />
              </div>
              <div>
                <Label className="mb-1.5 inline-block">Desired class</Label>
                <Input value={desiredClassName} onChange={(e) => setDesiredClassName(e.target.value)} placeholder="e.g. Class 3" />
              </div>
              <div>
                <Label className="mb-1.5 inline-block">
                  Parent/guardian name <span className="text-destructive">*</span>
                </Label>
                <Input value={parentName} onChange={(e) => setParentName(e.target.value)} required />
              </div>
              <div>
                <Label className="mb-1.5 inline-block">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <div>
                <Label className="mb-1.5 inline-block">Email</Label>
                <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div>
                <Label className="mb-1.5 inline-block">Address</Label>
                <Textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} />
              </div>

              {error && (
                <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" loading={submitMutation.isPending}>
                Submit Enquiry
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
