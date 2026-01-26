'use client';

import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreateJobSchema, type CreateJobInput } from '@trades/shared/types';
import { cn } from '@/lib/utils';

interface ServiceCategory {
  id: string;
  name: string;
  slug: string;
}

interface JobFormProps {
  serviceCategories: ServiceCategory[];
  onSubmit: (data: CreateJobInput, photos: File[]) => Promise<void>;
  isLoading?: boolean;
}

export function JobForm({ serviceCategories, onSubmit, isLoading }: JobFormProps) {
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoPreviewUrls, setPhotoPreviewUrls] = useState<string[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateJobInput>({
    resolver: zodResolver(CreateJobSchema),
    defaultValues: {
      serviceCountry: 'CA',
      urgency: 'NORMAL',
    },
  });

  const handlePhotoChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter((file) => {
      if (!file.type.startsWith('image/')) {
        setPhotoError('Only image files are allowed');
        return false;
      }
      if (file.size > 10 * 1024 * 1024) {
        setPhotoError('Images must be under 10MB');
        return false;
      }
      return true;
    });

    setPhotoError(null);
    setPhotos((prev) => [...prev, ...validFiles].slice(0, 5)); // Max 5 photos

    // Create preview URLs
    validFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreviewUrls((prev) => [...prev, reader.result as string].slice(0, 5));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removePhoto = useCallback((index: number) => {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    setPhotoPreviewUrls((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const handleFormSubmit = handleSubmit(async (data) => {
    if (photos.length === 0) {
      setPhotoError('At least one photo is required');
      return;
    }
    await onSubmit(data, photos);
  });

  return (
    <form onSubmit={handleFormSubmit} className="space-y-8">
      {/* Service Category */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Service Type</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {serviceCategories.map((category) => (
            <label
              key={category.id}
              className={cn(
                'relative flex items-center justify-center px-4 py-3 border rounded-lg cursor-pointer hover:border-primary-500 transition-colors',
                'has-[:checked]:border-primary-500 has-[:checked]:bg-primary-50 has-[:checked]:ring-1 has-[:checked]:ring-primary-500'
              )}
            >
              <input
                type="radio"
                {...register('serviceCategoryId')}
                value={category.id}
                className="sr-only"
              />
              <span className="text-sm font-medium text-gray-700">{category.name}</span>
            </label>
          ))}
        </div>
        {errors.serviceCategoryId && (
          <p className="mt-2 text-sm text-red-600">{errors.serviceCategoryId.message}</p>
        )}
      </div>

      {/* Photo Upload */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Before Photos</h3>
        <p className="text-sm text-gray-500 mb-4">
          Upload at least one photo showing the issue (max 5 photos)
        </p>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {photoPreviewUrls.map((url, index) => (
            <div key={index} className="relative aspect-square">
              <img
                src={url}
                alt={`Photo ${index + 1}`}
                className="w-full h-full object-cover rounded-lg"
              />
              <button
                type="button"
                onClick={() => removePhoto(index)}
                className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          ))}

          {photos.length < 5 && (
            <label className="aspect-square border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary-500 hover:bg-primary-50 transition-colors">
              <svg
                className="w-8 h-8 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              <span className="mt-2 text-xs text-gray-500">Add Photo</span>
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handlePhotoChange}
                className="sr-only"
              />
            </label>
          )}
        </div>

        {photoError && <p className="mt-2 text-sm text-red-600">{photoError}</p>}
      </div>

      {/* Job Details */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Job Details</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              {...register('title')}
              placeholder="e.g., Fix leaky faucet in kitchen"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description *
            </label>
            <textarea
              {...register('description')}
              rows={4}
              placeholder="Please describe the issue in detail..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
            {errors.description && (
              <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Urgency</label>
            <select
              {...register('urgency')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="LOW">Low - Can wait a few weeks</option>
              <option value="NORMAL">Normal - Within a week</option>
              <option value="HIGH">High - Within a few days</option>
              <option value="EMERGENCY">Emergency - ASAP</option>
            </select>
          </div>
        </div>
      </div>

      {/* Contact Information */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Contact Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Contact Name *
            </label>
            <input
              type="text"
              {...register('contactName')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.contactName && (
              <p className="mt-1 text-sm text-red-600">{errors.contactName.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Business Name (optional)
            </label>
            <input
              type="text"
              {...register('businessName')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number *
            </label>
            <input
              type="tel"
              {...register('contactPhone')}
              placeholder="(555) 123-4567"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.contactPhone && (
              <p className="mt-1 text-sm text-red-600">{errors.contactPhone.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email (optional)
            </label>
            <input
              type="email"
              {...register('contactEmail')}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.contactEmail && (
              <p className="mt-1 text-sm text-red-600">{errors.contactEmail.message}</p>
            )}
          </div>
        </div>
      </div>

      {/* Service Address */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Service Location</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Street Address *
            </label>
            <input
              type="text"
              {...register('serviceAddressLine1')}
              placeholder="123 Main Street"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            {errors.serviceAddressLine1 && (
              <p className="mt-1 text-sm text-red-600">{errors.serviceAddressLine1.message}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Unit/Suite (optional)
            </label>
            <input
              type="text"
              {...register('serviceAddressLine2')}
              placeholder="Suite 100"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
              <input
                type="text"
                {...register('serviceCity')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {errors.serviceCity && (
                <p className="mt-1 text-sm text-red-600">{errors.serviceCity.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Province *</label>
              <select
                {...register('serviceProvince')}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">Select</option>
                <option value="AB">Alberta</option>
                <option value="BC">British Columbia</option>
                <option value="MB">Manitoba</option>
                <option value="NB">New Brunswick</option>
                <option value="NL">Newfoundland and Labrador</option>
                <option value="NS">Nova Scotia</option>
                <option value="NT">Northwest Territories</option>
                <option value="NU">Nunavut</option>
                <option value="ON">Ontario</option>
                <option value="PE">Prince Edward Island</option>
                <option value="QC">Quebec</option>
                <option value="SK">Saskatchewan</option>
                <option value="YT">Yukon</option>
              </select>
              {errors.serviceProvince && (
                <p className="mt-1 text-sm text-red-600">{errors.serviceProvince.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Postal Code *
              </label>
              <input
                type="text"
                {...register('servicePostalCode')}
                placeholder="A1A 1A1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {errors.servicePostalCode && (
                <p className="mt-1 text-sm text-red-600">{errors.servicePostalCode.message}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Submit */}
      <div className="flex justify-end gap-4 pt-6 border-t">
        <button
          type="button"
          className="px-6 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          disabled={isLoading}
        >
          Save Draft
        </button>
        <button
          type="submit"
          disabled={isLoading}
          className="px-6 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
        >
          {isLoading && (
            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
                fill="none"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          Submit Job Request
        </button>
      </div>
    </form>
  );
}
