import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { FileText, ArrowLeft, Shield } from "lucide-react"
import Link from "next/link"

export default function PrivacyPage() {
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
              <div className="text-xs text-muted-foreground">Docx Solutions</div>
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
          <CardHeader className="border-b bg-green-50/50">
            <div className="flex items-center justify-center gap-3 mb-2">
              <Shield className="h-8 w-8 text-accent" />
            </div>
            <CardTitle className="text-3xl font-bold text-center">Privacy Policy</CardTitle>
            <p className="text-center text-sm text-muted-foreground mt-2">Last Updated: January 2025</p>
          </CardHeader>
          <CardContent className="prose prose-sm max-w-none p-8 space-y-6">
            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">1. Introduction</h2>
              <p className="text-muted-foreground leading-relaxed">
                VehicleRCDownload.com, operated by Docx Solutions ("we", "our", or "us"), is committed to protecting
                your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information
                when you use our Service. This policy complies with the Information Technology Act, 2000 and applicable
                privacy regulations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">2. Information We Collect</h2>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.1 Personal Information</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Full name and email address (for registered users)</li>
                <li>Phone number (optional, for account recovery)</li>
                <li>Password (stored in encrypted format)</li>
                <li>Vehicle registration numbers you search for</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.2 Payment Information</h3>
              <p className="text-muted-foreground leading-relaxed mb-2">
                Payment processing is handled by Razorpay. We do not store complete credit/debit card information. We
                receive:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Transaction ID and payment status</li>
                <li>Last 4 digits of card number (for reference)</li>
                <li>Payment method used</li>
                <li>Transaction timestamp and amount</li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">2.3 Automatic Information</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>IP address and browser type</li>
                <li>Device information and operating system</li>
                <li>Access times and referring website addresses</li>
                <li>Pages viewed and navigation patterns</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">3. How We Use Your Information</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">We use the collected information for:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Processing RC document download requests</li>
                <li>Managing user accounts and wallet balances</li>
                <li>Processing payments and maintaining transaction records</li>
                <li>Sending service-related notifications and updates</li>
                <li>Preventing fraud and ensuring service security</li>
                <li>Improving service quality and user experience</li>
                <li>Complying with legal and regulatory requirements</li>
                <li>Responding to customer support inquiries</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">4. Information Sharing and Disclosure</h2>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">4.1 We Share Information With:</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  <strong>Document/Data Providers:</strong> Third-party providers and official sources (as needed) to
                  fulfil your request
                </li>
                <li>
                  <strong>Payment Processors:</strong> Razorpay for secure payment processing
                </li>
                <li>
                  <strong>Service Providers:</strong> Hosting and infrastructure providers
                </li>
                <li>
                  <strong>Law Enforcement:</strong> When required by law or court order
                </li>
              </ul>

              <h3 className="text-lg font-medium text-foreground mt-4 mb-2">4.2 We Do NOT:</h3>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>Sell your personal information to third parties</li>
                <li>Share your data with advertisers or marketing companies</li>
                <li>Use your information for purposes other than stated</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">5. Data Security</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                We implement robust security measures to protect your information:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>SSL/TLS encryption for data transmission</li>
                <li>Encrypted storage of sensitive information</li>
                <li>Regular security audits and vulnerability assessments</li>
                <li>Access controls and authentication mechanisms</li>
                <li>Secure backup and disaster recovery procedures</li>
                <li>Employee training on data protection practices</li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                However, no method of transmission over the internet is 100% secure. While we strive to protect your
                information, we cannot guarantee absolute security.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">6. Data Retention</h2>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  <strong>Account Information:</strong> Retained while account is active, plus 3 years after closure
                </li>
                <li>
                  <strong>Transaction Records:</strong> Retained for 7 years as per financial regulations
                </li>
                <li>
                  <strong>Downloaded Documents:</strong> Not stored on our servers after delivery
                </li>
                <li>
                  <strong>Server Logs:</strong> Retained for 90 days for security purposes
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">7. Your Privacy Rights</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">You have the right to:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  <strong>Access:</strong> Request a copy of your personal data
                </li>
                <li>
                  <strong>Correction:</strong> Update inaccurate or incomplete information
                </li>
                <li>
                  <strong>Deletion:</strong> Request deletion of your account and associated data
                </li>
                <li>
                  <strong>Data Portability:</strong> Request your data in a portable format
                </li>
                <li>
                  <strong>Opt-out:</strong> Unsubscribe from promotional communications
                </li>
                <li>
                  <strong>Object:</strong> Object to certain data processing activities
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                To exercise these rights, contact us through the{" "}
                <Link href="/helpdesk" className="text-primary hover:underline">
                  helpdesk page
                </Link>{" "}
                or email support@vehiclercdownload.com
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">8. Cookies and Tracking</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">We use cookies and similar technologies for:</p>
              <ul className="list-disc pl-6 space-y-2 text-muted-foreground">
                <li>
                  <strong>Essential Cookies:</strong> Required for service functionality and security
                </li>
                <li>
                  <strong>Session Cookies:</strong> Maintain your login session
                </li>
                <li>
                  <strong>Analytics Cookies:</strong> Understand usage patterns and improve service
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed mt-3">
                You can control cookies through your browser settings, but disabling essential cookies may affect
                service functionality.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">9. Children's Privacy</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service is not intended for individuals under 18 years of age. We do not knowingly collect personal
                information from children. If we become aware that we have collected information from a child, we will
                take steps to delete such information promptly.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">10. Third-Party Links</h2>
              <p className="text-muted-foreground leading-relaxed">
                Our Service may contain links to third-party websites (such as Razorpay payment gateway). We are not
                responsible for the privacy practices of these external sites. We encourage you to review their privacy
                policies before providing any personal information.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">11. International Data Transfers</h2>
              <p className="text-muted-foreground leading-relaxed">
                Your information is primarily stored and processed in India. If data is transferred internationally, we
                ensure appropriate safeguards are in place to protect your information in accordance with applicable
                data protection laws.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">12. Changes to Privacy Policy</h2>
              <p className="text-muted-foreground leading-relaxed">
                We may update this Privacy Policy periodically. Significant changes will be notified via email or
                prominent website notice. The "Last Updated" date at the top indicates when changes were made. Your
                continued use of the Service after changes constitutes acceptance.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">13. Data Breach Notification</h2>
              <p className="text-muted-foreground leading-relaxed">
                In the event of a data breach that may compromise your personal information, we will notify affected
                users within 72 hours and provide details about the breach, potential impact, and steps being taken to
                address it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">14. Contact Us</h2>
              <p className="text-muted-foreground leading-relaxed mb-2">
                For privacy-related questions or concerns, contact us at:
              </p>
              <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 mt-3">
                <p className="text-foreground">
                  <strong>Data Protection Officer</strong>
                </p>
                <p className="text-muted-foreground mt-1">Docx Solutions</p>
                <p className="text-muted-foreground">VehicleRCDownload.com</p>
                <p className="text-muted-foreground">Isha Towers, 222/4, New Scheme Rd</p>
                <p className="text-muted-foreground">Near KVB Bank, Pappanaickenpalayam</p>
                <p className="text-muted-foreground">Coimbatore, Tamil Nadu 641037, India</p>
                <p className="text-muted-foreground mt-2">Email: support@vehiclercdownload.com</p>
                <p className="text-muted-foreground">Phone: 095855 33692</p>
              </div>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-foreground mb-3">15. Grievance Redressal</h2>
              <p className="text-muted-foreground leading-relaxed">
                If you have any grievances regarding data protection or privacy, you may file a complaint through our{" "}
                <Link href="/helpdesk" className="text-primary hover:underline">
                  helpdesk
                </Link>
                . We aim to resolve all grievances within 30 days. If unsatisfied with our response, you may escalate to
                the appropriate data protection authority.
              </p>
            </section>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
