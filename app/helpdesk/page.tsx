import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { FileText, ArrowLeft, Phone, Mail, MapPin, Clock, MessageSquare, HelpCircle } from "lucide-react"
import Link from "next/link"

export default function HelpdeskPage() {
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

      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-foreground mb-3">Help & Support</h1>
          <p className="text-lg text-muted-foreground">We're here to help you with any questions or concerns</p>
        </div>

        <div className="grid lg:grid-cols-3 gap-8 mb-12">
          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto p-4 bg-blue-50 rounded-full w-fit mb-3">
                <Phone className="h-8 w-8 text-primary" />
              </div>
              <CardTitle>Phone Support</CardTitle>
              <CardDescription>Speak with our support team</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-2">
              <p className="text-foreground font-semibold text-lg">095855 33692</p>
              <p className="text-sm text-muted-foreground">Mon-Fri: 9:00 AM - 6:00 PM IST</p>
              <p className="text-sm text-muted-foreground">Sat: 9:00 AM - 1:00 PM IST</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto p-4 bg-green-50 rounded-full w-fit mb-3">
                <Mail className="h-8 w-8 text-accent" />
              </div>
              <CardTitle>Email Support</CardTitle>
              <CardDescription>Get help via email</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-2">
              <p className="text-foreground font-medium">support@vehiclercdownload.com</p>
              <p className="text-sm text-muted-foreground mt-3">Technical Issues:</p>
              <p className="text-foreground font-medium">support@vehiclercdownload.com</p>
              <p className="text-sm text-muted-foreground mt-3">Response Time: 24-48 hours</p>
            </CardContent>
          </Card>

          <Card className="hover:shadow-lg transition-shadow">
            <CardHeader className="text-center">
              <div className="mx-auto p-4 bg-purple-50 rounded-full w-fit mb-3">
                <Clock className="h-8 w-8 text-purple-600" />
              </div>
              <CardTitle>Working Hours</CardTitle>
              <CardDescription>When we're available</CardDescription>
            </CardHeader>
            <CardContent className="text-center space-y-2">
              <p className="text-sm text-muted-foreground">Monday - Friday</p>
              <p className="text-foreground font-medium">9:00 AM - 6:00 PM IST</p>
              <p className="text-sm text-muted-foreground mt-3">Saturday</p>
              <p className="text-foreground font-medium">9:00 AM - 1:00 PM IST</p>
              <p className="text-sm text-muted-foreground mt-3">Sunday: Closed</p>
            </CardContent>
          </Card>
        </div>

        <div className="grid lg:grid-cols-2 gap-8">
          <Card className="shadow-lg">
            <CardHeader>
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-primary" />
                <CardTitle>Submit a Support Ticket</CardTitle>
              </div>
              <CardDescription>Fill out the form below and we'll get back to you within 24-48 hours</CardDescription>
            </CardHeader>
            <CardContent>
              <form className="space-y-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Full Name *</label>
                  <Input placeholder="Enter your full name" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Email Address *</label>
                  <Input type="email" placeholder="your.email@example.com" required />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Phone Number</label>
                  <Input type="tel" placeholder="+91 98765 43210" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Issue Category *</label>
                  <select className="w-full h-11 px-3 py-2 border border-input bg-background rounded-md text-sm">
                    <option value="">Select a category</option>
                    <option value="payment">Payment Issues</option>
                    <option value="download">Download Problems</option>
                    <option value="wallet">Wallet & Recharge</option>
                    <option value="account">Account Related</option>
                    <option value="technical">Technical Issues</option>
                    <option value="refund">Refund Request</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Order/Transaction ID</label>
                  <Input placeholder="e.g., TXN123456789" />
                </div>
                <div>
                  <label className="text-sm font-medium text-foreground mb-1.5 block">Message *</label>
                  <Textarea
                    placeholder="Please describe your issue in detail..."
                    className="min-h-[120px] resize-none"
                    required
                  />
                </div>
                <Button type="submit" className="w-full" size="lg">
                  Submit Ticket
                </Button>
                <p className="text-xs text-muted-foreground text-center">
                  You'll receive a confirmation email with your ticket number
                </p>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card className="shadow-lg">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <HelpCircle className="h-5 w-5 text-primary" />
                  <CardTitle>Frequently Asked Questions</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <h3 className="font-semibold text-foreground mb-2">How do I download an RC document?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Enter your vehicle registration number on the download page, verify the details, and proceed with
                    payment. You'll receive the RC document instantly as a PDF.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">What payment methods are accepted?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    We accept all major credit/debit cards, UPI, net banking, and wallet payments through Razorpay.
                    Registered users can also use wallet balance.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">How long does it take to get my RC?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    RC documents are delivered instantly after successful payment. If you don't receive it within 5
                    minutes, contact support.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">Can I get a refund?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Refunds are available if the document is not delivered or is incorrect. Wallet recharges are
                    non-refundable. Contact support with your transaction ID.
                  </p>
                </div>
                <div>
                  <h3 className="font-semibold text-foreground mb-2">How do I recharge my wallet?</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Logged-in users can recharge their wallet from the dashboard. Choose an amount and complete payment
                    via Razorpay.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card className="shadow-lg bg-blue-50/50 border-blue-200">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  <CardTitle>Office Address</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <p className="font-semibold text-foreground">Docx Solutions</p>
                <p className="text-muted-foreground">VehicleRCDownload.com</p>
                <p className="text-muted-foreground">Isha Towers, 222/4, New Scheme Rd</p>
                <p className="text-muted-foreground">Near KVB Bank, Pappanaickenpalayam</p>
                <p className="text-muted-foreground">Coimbatore, Tamil Nadu 641037</p>
                <p className="text-muted-foreground">India</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
