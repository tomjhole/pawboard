import { Building2 } from 'lucide-react'
import { Button, Card, EmptyState, PageHeader } from '@/components/ui'

export default function SpacesPage() {
  return (
    <div>
      <PageHeader
        title="Spaces"
        description="Accommodation areas and boarding spaces"
        action={<Button>+ Add space</Button>}
      />
      <Card padding="none">
        <EmptyState
          icon={<Building2 className="w-6 h-6" />}
          title="No spaces configured"
          description="Set up your accommodation areas and boarding spaces. Each space can be assigned a species, size category and capacity rule."
          action={<Button>+ Add space</Button>}
        />
      </Card>
    </div>
  )
}
