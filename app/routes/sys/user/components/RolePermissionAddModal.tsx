import { Button, Checkbox, Form, Input, message, Modal } from "antd";
import { getPermissionList, addRole } from "~/services/role";
import { useEffect, useState } from "react";
import { invalidateRoles } from "~/services/roleCache";
import { useRevalidator } from "react-router";
import type { PermissionTemplate, RoleMutationInput } from "~/types/api";
import { getErrorMessage } from "~/utils/errors";
import { requireApiSuccess } from "~/services/http";

interface Props {
  open: boolean;
  onClose: () => void;
}

export default function RolePermissionAddModal({ open, onClose }: Props) {
  const [permissionTree, setPermissionTree] = useState<PermissionTemplate[]>(
    [],
  );
  const [selectedKeys, setSelectedKeys] = useState<number[]>([]);
  const revalidator = useRevalidator();
  const [form] = Form.useForm<Omit<RoleMutationInput, "permissions">>();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [previousOpen, setPreviousOpen] = useState(open);

  // 开启新一轮弹窗时重置提示，避免 Effect 中同步触发额外渲染。
  if (previousOpen !== open) {
    setPreviousOpen(open);
    setReady(false);
    if (open) setLoadError("");
  }

  useEffect(() => {
    if (open) {
      const controller = new AbortController();
      getPermissionList(controller.signal)
        .then(result => {
          if (controller.signal.aborted) return;
          setPermissionTree(requireApiSuccess(result));
          setReady(true);
        })
        .catch(error => {
          if (!controller.signal.aborted)
            setLoadError(getErrorMessage(error, "权限列表加载失败"));
        });
      return () => controller.abort();
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!ready || loading) return;
    setLoading(true);
    try {
      const values = await form.validateFields();
      const { code, msg } = await addRole({
        ...values,
        permissions: selectedKeys,
      });
      message[code === 0 ? "success" : "error"](msg);
      if (code === 0) {
        onClose();
        form.resetFields();
        setSelectedKeys([]);
        invalidateRoles();
        await revalidator.revalidate();
      }
    } catch (error) {
      message.error(getErrorMessage(error, "角色创建失败"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onCancel={onClose}
      width={700}
      centered
      mask={{ blur: false }}
      title={
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-[#4A4A65] mb-1">
            创建角色权限
          </h2>
          <p className="text-gray-400 text-sm font-normal">
            配置该角色在系统中的功能权限
          </p>
        </div>
      }
      closable
      footer={
        <div className="flex justify-center gap-4 pb-4">
          <Button onClick={onClose}>取消</Button>
          <Button
            disabled={!ready}
            loading={loading}
            onClick={handleSubmit}
            type="primary"
          >
            确定
          </Button>
        </div>
      }
    >
      <section>
        {loadError && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {loadError}
          </p>
        )}
        <h3 className="text-lg font-bold text-[#4A4A65]">基本信息</h3>
        <Form
          form={form}
          layout="inline"
          size="large"
          className="grid! grid-cols-2 gap-4 my-4!"
        >
          <Form.Item
            name="roleName"
            rules={[{ required: true, message: "请输入角色名称" }]}
          >
            <Input placeholder="例如：超人强" />
          </Form.Item>
          <Form.Item
            name="roleKey"
            rules={[{ required: true, message: "请输入唯一标识" }]}
          >
            <Input placeholder="例如：GGBond" />
          </Form.Item>
        </Form>
        <div>
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-[#4A4A65]">权限设置</h3>
          </div>
          <div className="mt-2 max-h-[45vh] overflow-y-auto pr-2">
            {permissionTree?.map(item => (
              <div
                key={item.id}
                className="flex items-center justify-between py-4 border-b border-gray-50 group"
              >
                <div className="text-gray-600 font-medium">{item.name}</div>
                <div className="flex justify-end flex-wrap gap-x-6 gap-y-2 flex-1">
                  {item.actions.map(action => (
                    <Checkbox
                      checked={selectedKeys.includes(action.id)}
                      key={action.id}
                      onChange={e => {
                        if (e.target.checked) {
                          setSelectedKeys(prev => [...prev, action.id]);
                        } else {
                          setSelectedKeys(prev =>
                            prev.filter(item => item !== action.id),
                          );
                        }
                      }}
                    >
                      {action.name}
                    </Checkbox>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </Modal>
  );
}
