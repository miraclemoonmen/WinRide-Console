import {
  Button,
  Col,
  Drawer,
  Form,
  Input,
  message,
  Radio,
  Row,
  Select,
  Space,
} from "antd";
import { useRevalidator } from "react-router";
import { updateUser } from "~/services/user";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { invalidateRoles } from "~/services/roleCache";
import type { ConsoleUser, Role, UserMutationInput } from "~/types/api";
import { getErrorMessage } from "~/utils/errors";

interface Props {
  open: boolean;
  onClose: () => void;
  initialValues: ConsoleUser | null;
  roles: Role[];
}

export default function UserEditDrawer({
  open,
  onClose,
  initialValues,
  roles,
}: Props) {
  const [form] = Form.useForm<UserMutationInput>();
  const saveRequestRef = useRef<object | null>(null);
  const [saving, setSaving] = useState(false);
  const [previousInput, setPreviousInput] = useState({ open, initialValues });
  if (
    previousInput.open !== open ||
    previousInput.initialValues !== initialValues
  ) {
    setPreviousInput({ open, initialValues });
    setSaving(false);
  }
  useLayoutEffect(
    () => () => {
      saveRequestRef.current = null;
    },
    [open, initialValues],
  );
  const close = () => {
    saveRequestRef.current = null;
    onClose();
  };
  useEffect(() => {
    if (open && initialValues) {
      form.resetFields();
      form.setFieldsValue({
        ...initialValues,
        email: initialValues.email ?? undefined,
        phone: initialValues.phone ?? undefined,
        gender: initialValues.gender ?? undefined,
        remark: initialValues.remark ?? undefined,
      });
    }
  }, [open, initialValues, form]);
  const revalidator = useRevalidator();
  const onFinish = async (values: UserMutationInput) => {
    if (!open || !initialValues || saveRequestRef.current) return;
    const request = {};
    saveRequestRef.current = request;
    setSaving(true);
    try {
      const { msg, code } = await updateUser({
        id: initialValues.id,
        ...values,
      });
      // 即使已切换编辑对象，服务端成功写入仍须使共享角色缓存失效。
      if (code === 0) invalidateRoles();
      if (saveRequestRef.current === request) {
        message[code === 0 ? "success" : "error"](msg);
        if (code === 0) close();
      }
      if (code === 0) await revalidator.revalidate();
    } catch (error) {
      if (saveRequestRef.current === request)
        message.error(getErrorMessage(error, "用户保存失败，请重试"));
    } finally {
      if (saveRequestRef.current === request) {
        saveRequestRef.current = null;
        setSaving(false);
      }
    }
  };

  return (
    <Drawer
      mask={{ blur: false }}
      title="编辑用户"
      closable={false}
      open={open}
      onClose={close}
      extra={
        <Space>
          <Button onClick={close}>取消</Button>
          <Button loading={saving} onClick={() => form.submit()} type="primary">
            确定
          </Button>
        </Space>
      }
    >
      <Form
        disabled={saving}
        layout="vertical"
        name="user_edit"
        form={form}
        onFinish={onFinish}
      >
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item
              label="用户名"
              name="username"
              rules={[{ required: true, message: "请输入用户名" }]}
            >
              <Input placeholder="登录账号" autoComplete="off" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label="密码" name="password">
              <Input.Password
                placeholder="设置新密码"
                autoComplete="new-password"
              />
            </Form.Item>
          </Col>
        </Row>

        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label="性别" name="gender">
              <Radio.Group>
                <Radio value={1}>男</Radio>
                <Radio value={2}>女</Radio>
              </Radio.Group>
            </Form.Item>
          </Col>
        </Row>

        <Form.Item
          label="手机号"
          name="phone"
          rules={[{ pattern: /^1[3-9]\d{9}$/, message: "请输入正确的手机号" }]}
        >
          <Input placeholder="131********" />
        </Form.Item>

        <Form.Item
          label="电子邮箱"
          name="email"
          rules={[{ type: "email", message: "请输入有效的邮箱地址" }]}
        >
          <Input placeholder="example@mail.com" />
        </Form.Item>
        <Form.Item label="所属角色" name="roles">
          <Select
            fieldNames={{
              value: "id",
              label: "roleName",
            }}
            mode="multiple"
            options={roles}
          />
        </Form.Item>
      </Form>
    </Drawer>
  );
}
