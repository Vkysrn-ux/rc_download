import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, ArrowLeft } from "lucide-react"
import Link from "next/link"

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-blue-50/30 to-background">
      <header className="border-b bg-white shadow-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary rounded-lg">
              <FileText className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <div className="text-lg font-bold text-foreground">VehicleRCDownload.com</div>
              <div className="text-xs text-muted-foreground">Talonmind Technologies</div>
            </div>
          </div>
          <Link href="/">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Home
            </Button>
          </Link>
        </div>
      </header>

      <main className="container mx-auto px-4 py-12 max-w-4xl">
        <Card className="shadow-lg">
          <CardHeader className="border-b bg-blue-50/50">
            <CardTitle className="text-3xl font-bold text-center">Terms and Conditions</CardTitle>
            <p className="text-center text-sm text-muted-foreground mt-2">Last Updated: January 2025</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none p-8 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Acceptance of Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                By accessing and using VehicleRCDownload.com (the "Service"), you accept and agree to be bound by the
                terms and provisions of this agreement. If you do not agree to these terms, please do not use the
                Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Service Description</h2>
              <p className="text-muted-foreground leading-relaxed">
                VehicleRCDownload.com, a product of Talonmind Technologies (a registered company), provides a platform
                for downloading Vehicle Registration Certificate (RC) documents and other official documents. The
                Service may use third-party providers and data sources to fulfil your request.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. User Eligibility</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">To use this Service, you must:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Be at least 18 years of age</li>
                <li>Have the legal right to access vehicle information</li>
                <li>Provide accurate and complete registration information</li>
                <li>Maintain the security of your account credentials</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Pricing and Payments</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">Service fees are as follows:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  <strong>Guest Users:</strong> ₹22 per RC download (direct online payment)
                </li>
                <li>
                  <strong>Registered Users:</strong> ₹18 per RC download (via wallet balance)
                </li>
                <li>All payments are processed through a third-party payment gateway</li>
                <li>Wallet recharges are non-refundable once processed</li>
                <li>Prices are inclusive of all applicable taxes</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Wallet Terms</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                For registered users using the wallet feature:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Wallet balance has no expiry date</li>
                <li>Wallet funds can only be used for RC document downloads</li>
                <li>Wallet recharges are non-transferable and non-refundable</li>
                <li>Minimum recharge amount is ₹50</li>
                <li>Account closure will result in forfeiture of remaining wallet balance</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Refund Policy</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Refunds are provided under the following conditions:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>If the RC document is not delivered within 24 hours of payment</li>
                <li>If the RC document delivered is incorrect or corrupted</li>
                <li>Refund requests must be submitted within 7 days of transaction</li>
                <li>Wallet recharges are not eligible for refunds once processed</li>
                <li>Processing time for approved refunds: 5-7 business days</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. User Responsibilities</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">Users are responsible for:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Providing accurate vehicle registration numbers</li>
                <li>Maintaining confidentiality of account credentials</li>
                <li>Using downloaded documents only for legitimate purposes</li>
                <li>Not sharing, reselling, or redistributing downloaded documents</li>
                <li>Complying with all applicable laws and regulations</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Prohibited Activities</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">Users must not:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Access or attempt to access RC documents without proper authorization</li>
                <li>Use the Service for any illegal or fraudulent purposes</li>
                <li>Attempt to reverse engineer, hack, or compromise the Service</li>
                <li>Create multiple accounts to abuse promotional offers</li>
                <li>Share account credentials with unauthorized parties</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Service Availability</h2>
              <p className="text-muted-foreground leading-relaxed">
                While we strive for 99.9% uptime, the Service may be temporarily unavailable due to maintenance,
                technical issues, or factors beyond our control. We do not guarantee uninterrupted access and are not
                liable for any losses resulting from service downtime.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Limitation of Liability</h2>
              <p className="text-muted-foreground leading-relaxed">
                VehicleRCDownload.com and Talonmind Technologies shall not be liable for any indirect, incidental, special,
                consequential, or punitive damages resulting from your use of the Service. Our total liability shall
                not exceed the amount paid by you for the specific transaction in question.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">11. Data Accuracy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Document data may be sourced from third-party providers and official sources. While we strive for
                accuracy, we are not responsible for errors in source data. Users should verify critical information
                with the relevant authority.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">12. Account Termination</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to suspend or terminate user accounts that violate these terms, engage in
                fraudulent activity, or abuse the Service. Upon termination, all remaining wallet balance will be
                forfeited.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">13. Modifications to Terms</h2>
              <p className="text-muted-foreground leading-relaxed">
                We reserve the right to modify these terms at any time. Users will be notified of significant changes
                via email or website notification. Continued use of the Service after changes constitutes acceptance of
                modified terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">14. Governing Law</h2>
              <p className="text-muted-foreground leading-relaxed">
                These terms shall be governed by and construed in accordance with the laws of India. Any disputes
                arising from these terms or the Service shall be subject to the exclusive jurisdiction of courts in
                Coimbatore, Tamil Nadu, India.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">15. Contact Information</h2>
              <p className="text-muted-foreground leading-relaxed">
                For questions about these Terms and Conditions, please contact our helpdesk at{" "}
                <Link href="/helpdesk" className="text-primary hover:underline">
                  helpdesk page
                </Link>{" "}
                or email support@vehiclercdownload.com, or call 96779-79393.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
