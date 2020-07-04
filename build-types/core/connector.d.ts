export interface PrivateSettings {
    json_key: string;
    view_id?: string | null;
    lookup_anonymous_ids_enabled: boolean;
    lookup_anonymous_ids_prefix?: string | null;
    lookup_attribute?: string | null;
    lookup_attribute_userid?: string | null;
    user_synchronized_segments: string[];
    account_id?: string | null;
    webproperty_id?: string | null;
    enable_inboundparse?: boolean;
}
