import {
  useActionMutation,
  useActionQuery,
} from "@agent-native/core/client/hooks";
import {
  ArrowLeft,
  CheckCircle2,
  FileText,
  FileUp,
  Lock,
  Plus,
  Search,
  Store,
  Upload,
} from "lucide-react";
import { useRef, useState } from "react";
import { useNavigate } from "react-router";
import { toast } from "sonner";

import { ActionMorphButton } from "@/components/returnly/ActionMorphButton";
import { AnimatedHeading } from "@/components/returnly/AnimatedHeading";
import { Btn } from "@/components/returnly/Btn";
import { formatMoneyMinor, formatRelativeDate } from "@/lib/motion-tokens";

export function meta() {
  return [{ title: "Purchase Vault - Returnly" }];
}

export default function BuyerVaultRoute() {
  const navigate = useNavigate();
  const receiptFileInput = useRef<HTMLInputElement>(null);
  const {
    data: purchases = [],
    isLoading,
    error,
    refetch,
  } = useActionQuery("list-purchases", {});

  const [search, setSearch] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);

  const [productName, setProductName] = useState("");
  const [merchantName, setMerchantName] = useState("");
  const [amountMajor, setAmountMajor] = useState("");
  const [purchasedDate, setPurchasedDate] = useState(() =>
    new Date().toLocaleDateString("en-CA"),
  );
  const [serial, setSerial] = useState("");
  const [receiptId, setReceiptId] = useState<string | null>(null);
  const [discloseReceipt, setDiscloseReceipt] = useState(false);
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [extractedPreview, setExtractedPreview] = useState<any | null>(null);

  const ingestMut = useActionMutation("ingest-receipt", {
    onSuccess: (res) => {
      setExtractedPreview(res);
      setReceiptId(res.attachmentId);
      if (res.fields?.merchantName?.value) {
        setMerchantName(res.fields.merchantName.value);
      }
      if (res.fields?.productName?.value) {
        setProductName(res.fields.productName.value);
      }
      if (res.fields?.amountMinor?.value != null) {
        setAmountMajor(String(res.fields.amountMinor.value / 100));
      }
      toast.success(res.message);
    },
    onError: (err) => toast.error(err.message),
  });

  const createMut = useActionMutation("create-purchase", {
    onSuccess: (res) => {
      toast.success(res.message);
      setShowAddModal(false);
      navigate(`/buyer/purchases/${res.id}`);
    },
    onError: (err) => toast.error(err.message),
  });

  const handleReceiptFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      toast.error("File size under 4 MB required");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === "string" ? reader.result : "";
      if (!dataUrl) return;
      setUploadedFileName(file.name);
      setShowAddModal(true);
      ingestMut.mutate({
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        dataUrl,
        discloseToMerchant: discloseReceipt,
        hintMerchantName: merchantName || "Northline Audio",
        hintProductName: productName || file.name.replace(/\.[^.]+$/, ""),
        hintAmountMajor: amountMajor ? Number(amountMajor) : undefined,
      });
    };
    reader.readAsDataURL(file);
  };

  const filtered = purchases.filter(
    (p: any) =>
      p.productName.toLowerCase().includes(search.toLowerCase()) ||
      p.merchantName.toLowerCase().includes(search.toLowerCase()) ||
      (p.orderNumber ?? "").toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="returnly-grid-backdrop returnly-workspace min-h-full px-4 py-5 sm:px-6 sm:py-6">
      <div className="mx-auto max-w-5xl space-y-4">
        <Btn
          to="/buyer/home"
          variant="soft"
          size="sm"
          icon={<ArrowLeft className="size-3.5" />}
        >
          Back to purchases
        </Btn>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <AnimatedHeading
              text="Purchase vault"
              className="text-2xl sm:text-3xl"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Btn
              variant="secondary"
              size="sm"
              icon={<Upload className="size-3.5" />}
              onClick={() => receiptFileInput.current?.click()}
            >
              Add receipt
            </Btn>
            <input
              ref={receiptFileInput}
              aria-label="Receipt file"
              tabIndex={-1}
              type="file"
              accept="image/*,application/pdf"
              onChange={handleReceiptFileChange}
              className="sr-only"
            />
            <Btn
              variant="primary"
              size="sm"
              icon={<Plus className="size-3.5" />}
              onClick={() => setShowAddModal((v) => !v)}
            >
              {showAddModal ? "Cancel" : "Add Purchase"}
            </Btn>
          </div>
        </div>

        {/* Add Purchase Form */}
        {showAddModal ? (
          <div className="rounded-[24px] border border-[#18181B] bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E4E7] pb-3">
              <h3 className="text-sm font-bold text-[#18181B]">New Purchase</h3>

              <div className="flex items-center gap-2">
                <ActionMorphButton
                  state={ingestMut.isPending ? "submitting" : "idle"}
                  idleLabel="Sample values"
                  submittingLabel="Loading…"
                  variant="outline"
                  size="sm"
                  icon={<FileUp className="size-3.5" />}
                  onClick={() =>
                    ingestMut.mutate({
                      fileName: "northline-studio-buds-receipt.pdf",
                      mimeType: "application/pdf",
                      size: 132_000,
                      hintMerchantName: "Northline Audio",
                      hintProductName: "Studio Monitor Earbuds Pro",
                      hintAmountMajor: 32000,
                    })
                  }
                />
              </div>
            </div>

            {extractedPreview ? (
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E4E4E7] bg-[#F4F4F5] px-3 py-2 text-[12px] font-medium text-[#18181B]">
                <div className="flex items-center gap-2">
                  <FileText className="size-3.5 text-[#52525B]" />
                  <span>
                    {extractedPreview.attachmentId
                      ? `Receipt saved: ${uploadedFileName || "file"}`
                      : "Sample values applied"}
                  </span>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-1.5 text-[11px] font-bold text-[#18181B]">
                  <input
                    type="checkbox"
                    checked={discloseReceipt}
                    onChange={(e) => setDiscloseReceipt(e.target.checked)}
                    className="size-3.5 rounded accent-[#18181B]"
                  />
                  <Lock className="size-3" />
                  <span>Share with store</span>
                </label>
              </div>
            ) : null}

            <form
              onSubmit={(e) => {
                e.preventDefault();
                const amountMinor = Math.round(
                  (Number(amountMajor) || 0) * 100,
                );
                createMut.mutate({
                  productName,
                  merchantName,
                  amountMinor,
                  currencyCode: "NGN",
                  serial: serial.trim() || null,
                  orderNumber: null,
                  purchasedAt: new Date(
                    `${purchasedDate}T00:00:00`,
                  ).toISOString(),
                  sourceType: receiptId ? "receipt_upload" : "manual",
                  receiptId,
                });
              }}
              className="mt-4 grid gap-3 sm:grid-cols-2"
            >
              <div>
                <label
                  htmlFor="purchase-product"
                  className="block text-[12px] font-bold text-[#18181B]"
                >
                  Product
                </label>
                <input
                  id="purchase-product"
                  type="text"
                  required
                  placeholder="e.g. Wireless Headphones"
                  value={productName}
                  onChange={(e) => setProductName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[13px] font-medium text-[#18181B]"
                />
              </div>

              <div>
                <label
                  htmlFor="purchase-store"
                  className="block text-[12px] font-bold text-[#18181B]"
                >
                  Store
                </label>
                <input
                  id="purchase-store"
                  type="text"
                  required
                  placeholder="Northline Audio"
                  value={merchantName}
                  onChange={(e) => setMerchantName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[13px] font-medium text-[#18181B]"
                />
              </div>

              <div>
                <label
                  htmlFor="purchase-price"
                  className="block text-[12px] font-bold text-[#18181B]"
                >
                  Price (₦)
                </label>
                <input
                  id="purchase-price"
                  type="number"
                  required
                  min={1}
                  value={amountMajor}
                  onChange={(e) => setAmountMajor(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[13px] font-medium text-[#18181B] tabular-nums"
                />
              </div>

              <div>
                <label
                  htmlFor="purchase-serial"
                  className="block text-[12px] font-bold text-[#18181B]"
                >
                  Serial (Optional)
                </label>
                <input
                  id="purchase-serial"
                  type="text"
                  placeholder="Optional"
                  value={serial}
                  onChange={(e) => setSerial(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#18181B]"
                />
              </div>

              <div>
                <label
                  htmlFor="purchase-date"
                  className="block text-[12px] font-bold text-[#18181B]"
                >
                  Purchase Date
                </label>
                <input
                  id="purchase-date"
                  type="date"
                  required
                  max={new Date().toLocaleDateString("en-CA")}
                  value={purchasedDate}
                  onChange={(e) => setPurchasedDate(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-[#E4E4E7] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#18181B]"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end pt-2">
                <ActionMorphButton
                  type="submit"
                  state={createMut.isPending ? "submitting" : "idle"}
                  idleLabel="Save Purchase"
                  submittingLabel="Saving…"
                  variant="ink"
                  size="sm"
                  icon={<CheckCircle2 className="size-3.5" />}
                />
              </div>
            </form>
          </div>
        ) : null}

        {/* Search Filter */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-[#71717A]" />
          <input
            type="text"
            aria-label="Search purchases"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products or stores…"
            className="w-full rounded-full border border-[#E4E4E7] bg-white py-2.5 pl-11 pr-4 text-[13px] font-medium text-[#18181B] shadow-2xs focus:border-[#18181B] focus:outline-none"
          />
        </div>

        {/* Purchases List */}
        {isLoading ? (
          <div className="grid gap-3 md:grid-cols-2">
            <div className="h-36 animate-pulse rounded-[24px] bg-[#E4E4E7]/60" />
            <div className="h-36 animate-pulse rounded-[24px] bg-[#E4E4E7]/60" />
          </div>
        ) : error ? (
          <div
            role="alert"
            className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <p>{error.message}</p>
            <Btn
              onClick={() => void refetch()}
              variant="secondary"
              size="sm"
              icon={null}
              className="mt-3"
            >
              Try again
            </Btn>
          </div>
        ) : filtered.length === 0 ? (
          <div className="rounded-[24px] border border-dashed border-[#D4D4D8] bg-white p-8 text-center">
            <p className="text-sm font-bold text-[#18181B]">
              No purchases found
            </p>
            {search && (
              <Btn
                onClick={() => setSearch("")}
                variant="soft"
                size="sm"
                icon={null}
                className="mt-3"
              >
                Clear search
              </Btn>
            )}
          </div>
        ) : (
          <div
            className={
              filtered.length > 1 ? "grid gap-3 md:grid-cols-2" : "grid gap-3"
            }
          >
            {filtered.map((p: any) => (
              <div
                key={p.id}
                className="flex flex-col justify-between rounded-[24px] border border-[#E4E4E7] bg-white p-4 shadow-xs transition-all hover:border-[#18181B] sm:p-5"
              >
                <div>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-0.5 text-[10px] font-bold text-[#3F3F46]">
                        <Store className="size-3" />
                        {p.merchantName}
                      </span>
                      <h3 className="mt-1 break-words text-base font-semibold text-[#18181B]">
                        {p.productName}
                      </h3>
                      <p className="text-[12px] text-[#71717A]">
                        #{p.orderNumber || "Manual"} ·{" "}
                        {formatRelativeDate(p.purchasedAt)}
                      </p>
                    </div>
                    <span className="rounded-xl bg-[#18181B] px-2.5 py-1 text-[12px] font-bold text-white tabular-nums">
                      {formatMoneyMinor(p.amountMinor, p.currencyCode)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full border border-[#E4E4E7] bg-[#F4F4F5] px-2 py-0.5 font-mono text-[10px] font-bold text-[#71717A]">
                      #RCPT-
                      {(p.receiptId || p.id)
                        .replace(/-/g, "")
                        .slice(0, 8)
                        .toUpperCase()}
                    </span>
                    <span className="rounded-full border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-0.5 font-semibold text-[#18181B]">
                      {p.coverage?.returnLabel}
                    </span>
                    <span className="rounded-full border border-[#E4E4E7] bg-[#FAFAFA] px-2.5 py-0.5 font-semibold text-[#71717A]">
                      {p.coverage?.warrantyLabel}
                    </span>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[#E4E4E7] pt-3">
                  <Btn
                    to={`/buyer/purchases/${p.id}`}
                    variant="soft"
                    size="sm"
                    icon={null}
                  >
                    Details
                  </Btn>
                  <Btn
                    to={`/buyer/purchases/${p.id}?report=1`}
                    variant="primary"
                    size="sm"
                    icon={<FileText className="size-3.5" />}
                  >
                    Report Problem
                  </Btn>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
